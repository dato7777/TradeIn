-- TradeIn initial schema (local Postgres / Supabase compatible)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'scraper')),
    grade_columns JSONB NOT NULL,
    trade_in_url TEXT,
    api_url TEXT,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    raw_device_name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    brand TEXT NOT NULL CHECK (brand IN ('apple', 'samsung')),
    model TEXT,
    storage_gb TEXT,
    grade TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    scraped_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    job_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, normalized_name, grade)
);

CREATE INDEX IF NOT EXISTS idx_company_prices_company ON company_prices(company_id);
CREATE INDEX IF NOT EXISTS idx_company_prices_normalized ON company_prices(normalized_name);
CREATE INDEX IF NOT EXISTS idx_company_prices_brand ON company_prices(brand);

CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS upload_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed companies
INSERT INTO companies (slug, name, source_type, grade_columns, trade_in_url, api_url, color) VALUES
(
    'dynamica', 'Dynamica', 'upload',
    '[{"key":"a","label":"A תקין","summary_tier":1},{"key":"b","label":"B תקין","summary_tier":2},{"key":"c","label":"C שבור / סדוק","summary_tier":3},{"key":"d","label":"D תקול","summary_tier":4}]'::jsonb,
    NULL, NULL, '#fce4ec'
),
(
    'partner', 'Partner', 'upload',
    '[{"key":"a","label":"תקין","summary_tier":1}]'::jsonb,
    NULL, NULL, '#e3f2fd'
),
(
    'ksp', 'KSP', 'scraper',
    '[{"key":"a","label":"כחדש לחלוטין","summary_tier":1},{"key":"b","label":"ללא שבר / סדק","summary_tier":2},{"key":"c","label":"שבר / סדק","summary_tier":3},{"key":"d","label":"תקול","summary_tier":4}]'::jsonb,
    'https://ksp.co.il/kspTradeIn/',
    'https://ksp.co.il/kspTradeIn/server/actions.php?action=get-new-data',
    '#fff9c4'
),
(
    'pelephone', 'Pelephone', 'scraper',
    '[{"key":"a","label":"תקין","summary_tier":1},{"key":"b","label":"תקין חלקית","summary_tier":3},{"key":"c","label":"תקול","summary_tier":4}]'::jsonb,
    'https://www.pelephone.co.il/ds/heb/eshop/trade-in/',
    NULL, '#e8f5e9'
)
ON CONFLICT (slug) DO NOTHING;
