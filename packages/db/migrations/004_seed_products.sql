INSERT INTO products (name, slug, category) VALUES
('Септик (станция)', 'septic-station', 'kanalizaciya'),
('Труба ПНД 32', 'pnd-pipe-32', 'vodosnabzhenie')
ON CONFLICT (slug) DO NOTHING;

-- добавим товар в прайс компании Москва 1
INSERT INTO company_items (company_id, kind, product_id, price_min, price_max)
SELECT c.id, 'product', p.id, 2500, 4500
FROM companies c
JOIN products p ON p.slug='pnd-pipe-32'
WHERE c.name='Компания Москва 1';
