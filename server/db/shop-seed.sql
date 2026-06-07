INSERT INTO products (
  slug,
  name,
  description,
  category,
  unit_amount,
  currency,
  stock_quantity,
  image_path,
  active,
  stripe_tax_code
) VALUES
  (
    'dog',
    'Dog',
    'Handmade crochet dog in a cozy green sweater, created as a cheerful shelf companion or thoughtful gift.',
    'amigurumi',
    19000,
    'sek',
    10,
    'assets/images/amigurumi-dog.jpg',
    true,
    NULL
  ),
  (
    'forest-friend-fox',
    'Forest Friend Fox',
    'Handmade crochet fox with a soft finish for gifting, shelf display, or imaginative play.',
    'amigurumi',
    19000,
    'sek',
    10,
    'assets/images/amigurumi-fox.svg',
    true,
    NULL
  ),
  (
    'pocket-ocean-octopus',
    'Pocket Ocean Octopus',
    'Small crochet octopus made as a cheerful handmade companion and easy gift item.',
    'amigurumi',
    17000,
    'sek',
    12,
    'assets/images/amigurumi-octopus.svg',
    true,
    NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  unit_amount = EXCLUDED.unit_amount,
  currency = EXCLUDED.currency,
  stock_quantity = EXCLUDED.stock_quantity,
  image_path = EXCLUDED.image_path,
  active = EXCLUDED.active,
  stripe_tax_code = EXCLUDED.stripe_tax_code,
  updated_at = CURRENT_TIMESTAMP;

UPDATE products
SET active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE category <> 'amigurumi';

INSERT INTO product_images (product_id, image_path, sort_order)
SELECT id, image_path, 1
FROM products
WHERE slug IN ('dog', 'forest-friend-fox', 'pocket-ocean-octopus')
ON CONFLICT (product_id, image_path) DO NOTHING;
