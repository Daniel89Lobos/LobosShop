const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

function splitSqlStatements(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function getStatementLabel(statement) {
  return statement.replace(/\s+/g, " ").slice(0, 120);
}

async function runSqlFile(client, filename) {
  const filePath = path.join(__dirname, "..", "db", filename);
  const sql = await fs.promises.readFile(filePath, "utf8");
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    try {
      await client.query(statement);
      console.log(`Applied: ${getStatementLabel(statement)}`);
    } catch (error) {
      console.error(`Failed: ${getStatementLabel(statement)}`);
      throw error;
    }
  }
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await runSqlFile(client, "shop-schema.sql");
    await runSqlFile(client, "product-images-migration.sql");
    await client.query("COMMIT");
    console.log("Shop schema migration completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Shop schema migration failed:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
