CREATE TABLE IF NOT EXISTS featured_products (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slot_index INTEGER NOT NULL UNIQUE CHECK (slot_index >= 1 AND slot_index <= 5),
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  highlight_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_featured_products_product_id
  ON featured_products (product_id);
