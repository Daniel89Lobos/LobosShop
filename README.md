# Lobos Shop

Full-stack shop application with an Express backend, PostgreSQL database, and static frontend.

## Production deployment (VPS)

This project is set up to run with:

- Node backend on `127.0.0.1:3000`
- PostgreSQL on VPS local network
- Nginx serving frontend and proxying `/api` to backend

### 1) Backend environment variables

Create `server/.env`:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=lobos_shop
DB_USER=postgres
DB_PASSWORD=your_password
SESSION_SECRET=your_long_random_secret
FRONTEND_URL=http://your-server-ip
```

Note: this VPS uses PostgreSQL on port `5433`.

### 2) Database schema

Required tables are defined in `server/db/shop-schema.sql` and include:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  group_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
```

### 3) Frontend API base path

Frontend calls use same-origin `/api/...` requests in `server/public/script.js`.

This avoids CORS/session cookie issues when Nginx serves frontend and proxies API.

### 4) Run backend

```bash
cd server
npm install
npm run dev
```

Health endpoint:

- `http://127.0.0.1:3000/api/health`

### 5) Suggested Nginx config

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/LobosShop/server/public;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6) Keep backend running (PM2)

```bash
npm install -g pm2
cd /var/www/LobosShop/server
pm2 start server.js --name lobos-shop
pm2 save
pm2 startup
```

## Quick verification

- `GET /api/health`
- `GET /api/products`
- `GET /api/cart` (authenticated)
- `POST /api/register`
- `POST /api/login` (with cookie jar)
- `PUT /api/cart` (authenticated)
- `POST /api/checkout/session`
