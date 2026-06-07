CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1 CHECK (sort_order >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id, image_path),
  UNIQUE (product_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id_sort_order
  ON product_images (product_id, sort_order);

INSERT INTO product_images (product_id, image_path, sort_order)
SELECT id, image_path, 1
FROM products p
WHERE image_path IS NOT NULL
  AND image_path <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM product_images pi
    WHERE pi.product_id = p.id
  )
ON CONFLICT DO NOTHING;
