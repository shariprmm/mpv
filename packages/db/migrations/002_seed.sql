INSERT INTO regions (name, slug) VALUES
('Москва', 'moskva'),
('Санкт-Петербург', 'sankt-peterburg')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO services (name, slug, category) VALUES
('Септики', 'septiki', 'kanalizaciya'),
('Дренаж участка', 'drenazh-uchastka', 'drenazh'),
('Заборы', 'zabory', 'zabory')
ON CONFLICT (slug) DO NOTHING;

-- компания
INSERT INTO companies (name, region_id, rating, reviews_count, is_verified, location)
SELECT 'Тестовая компания', r.id, 4.7, 12, true, ST_GeogFromText('POINT(30.31413 59.93863)')
FROM regions r WHERE r.slug='sankt-peterburg'
ON CONFLICT DO NOTHING;

-- прайс на услугу
INSERT INTO company_items (company_id, kind, service_id, price_min, price_max)
SELECT c.id, 'service', s.id, 10000, 25000
FROM companies c
JOIN services s ON s.slug='drenazh-uchastka'
WHERE c.name='Тестовая компания';
