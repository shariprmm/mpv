CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general'
);

ALTER TABLE company_items
  ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id);

-- для kind='product' можно хранить product_id
CREATE INDEX IF NOT EXISTS idx_company_items_product ON company_items(product_id);
