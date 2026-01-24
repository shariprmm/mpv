CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  region_id INT NOT NULL REFERENCES regions(id),
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  reviews_count INT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  location GEOGRAPHY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS company_items (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service','product','custom')),
  service_id INT REFERENCES services(id),
  custom_title TEXT,
  price_min INT,
  price_max INT,
  currency TEXT NOT NULL DEFAULT 'RUB'
);

CREATE INDEX IF NOT EXISTS idx_companies_region ON companies(region_id);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_company_items_company ON company_items(company_id);
CREATE INDEX IF NOT EXISTS idx_company_items_service ON company_items(service_id);
