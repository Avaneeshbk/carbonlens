-- ═══════════════════════════════════════════════════════════════════
-- CarbonLens — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ───────────────────────────────────────────────────────────────────
-- TABLE: companies
-- One company per SME account. A user always belongs to one company.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identity
  name          TEXT NOT NULL,
  gstin         TEXT UNIQUE,
  cin           TEXT UNIQUE,
  address       TEXT,
  phone         TEXT,
  website       TEXT,

  -- Classification
  state         TEXT NOT NULL DEFAULT 'Maharashtra',
  industry      TEXT NOT NULL DEFAULT 'Other Manufacturing',
  employees     INTEGER,
  annual_turnover_cr NUMERIC(12,2),   -- ₹ crore

  -- Plan / billing
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),
  plan_active   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Onboarding
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- TABLE: profiles
-- Extends Supabase auth.users. Created automatically via trigger.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  avatar_url    TEXT,
  phone         TEXT
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ───────────────────────────────────────────────────────────────────
-- TABLE: facilities
-- A company can have multiple plants / sites (Professional+ plan)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,           -- "Plant 1 — Bhosari"
  state         TEXT NOT NULL,
  address       TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE
);


-- ───────────────────────────────────────────────────────────────────
-- TABLE: emission_factors
-- Centralised, versioned emission factor database.
-- Admins can update without redeploying the frontend.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emission_factors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to      DATE,                    -- NULL = currently active

  scope         INTEGER NOT NULL CHECK (scope IN (1,2,3)),
  category      TEXT NOT NULL,           -- 'fuel' | 'grid' | 'material' | 'logistics'
  key           TEXT NOT NULL,           -- 'diesel' | 'Maharashtra' | 'steel' | 'road'
  label         TEXT NOT NULL,
  ef_value      NUMERIC(12,6) NOT NULL,  -- kg CO2e per unit
  unit          TEXT NOT NULL,           -- 'litres' | 'kWh' | 'tonne' | 'tonne-km'
  source        TEXT NOT NULL,           -- 'CEA 2024' | 'IPCC AR6' | 'GHG Protocol'
  notes         TEXT
);

-- Seed current emission factors
-- Scope 2: India CEA 2024 state grid factors (kg CO2/kWh)
INSERT INTO emission_factors (scope, category, key, label, ef_value, unit, source) VALUES
  (2,'grid','Andhra Pradesh',   'Andhra Pradesh Grid',    0.79, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Bihar',            'Bihar Grid',             0.91, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Chhattisgarh',     'Chhattisgarh Grid',      0.98, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Delhi',            'Delhi Grid',             0.82, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Goa',              'Goa Grid',               0.71, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Gujarat',          'Gujarat Grid',           0.85, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Haryana',          'Haryana Grid',           0.84, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Himachal Pradesh', 'HP Grid',                0.26, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Jharkhand',        'Jharkhand Grid',         0.97, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Karnataka',        'Karnataka Grid',         0.74, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Kerala',           'Kerala Grid',            0.49, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Madhya Pradesh',   'MP Grid',                0.94, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Maharashtra',      'Maharashtra Grid',       0.82, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Odisha',           'Odisha Grid',            0.87, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Punjab',           'Punjab Grid',            0.74, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Rajasthan',        'Rajasthan Grid',         0.92, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Tamil Nadu',       'Tamil Nadu Grid',        0.71, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Telangana',        'Telangana Grid',         0.83, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Uttar Pradesh',    'UP Grid',                0.93, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Uttarakhand',      'Uttarakhand Grid',       0.33, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','West Bengal',      'West Bengal Grid',       0.87, 'kWh', 'CEA Annual Report 2024'),
  (2,'grid','Other',            'National Average Grid',  0.82, 'kWh', 'CEA Annual Report 2024');

-- Scope 1: Fuel combustion (kg CO2e per unit)
INSERT INTO emission_factors (scope, category, key, label, ef_value, unit, source) VALUES
  (1,'fuel','diesel',     'Diesel',            2.68, 'litres', 'IPCC AR6 Table A.II.4'),
  (1,'fuel','lpg',        'LPG / Propane',     1.51, 'litres', 'IPCC AR6 Table A.II.4'),
  (1,'fuel','coal',       'Coal (Thermal)',     2.42, 'kg',     'IPCC AR6 Table A.II.4'),
  (1,'fuel','petrol',     'Petrol',            2.31, 'litres', 'IPCC AR6 Table A.II.4'),
  (1,'fuel','cng',        'CNG / Natural Gas', 2.21, 'kg',     'IPCC AR6 Table A.II.4'),
  (1,'fuel','furnaceOil', 'Furnace Oil / HFO', 3.15, 'litres', 'IPCC AR6 Table A.II.4');

-- Scope 3 Cat 1: Raw material embodied carbon (kg CO2e per tonne)
INSERT INTO emission_factors (scope, category, key, label, ef_value, unit, source) VALUES
  (3,'material','steel',    'Steel / Iron',       1800, 'tonne', 'Ecoinvent 3.9 / GHG Protocol Product Standard'),
  (3,'material','cement',   'Cement / Concrete',   820, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','aluminum', 'Aluminum',           8900, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','copper',   'Copper',             3900, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','plastic',  'Plastics (mixed)',   1900, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','paper',    'Paper / Cardboard',   900, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','glass',    'Glass',               850, 'tonne', 'Ecoinvent 3.9'),
  (3,'material','rubber',   'Rubber (synthetic)', 2900, 'tonne', 'Ecoinvent 3.9');

-- Scope 3 Cat 4/9: Logistics (kg CO2e per tonne-km)
INSERT INTO emission_factors (scope, category, key, label, ef_value, unit, source) VALUES
  (3,'logistics','road', 'Road (Diesel Truck)',  0.096, 'tonne-km', 'GLEC Framework v2 / MoRTH 2023'),
  (3,'logistics','rail', 'Rail (Indian Railways)',0.028, 'tonne-km', 'GLEC Framework v2'),
  (3,'logistics','air',  'Air Freight',          0.602, 'tonne-km', 'GLEC Framework v2'),
  (3,'logistics','sea',  'Sea / Coastal Barge',  0.016, 'tonne-km', 'GLEC Framework v2');


-- ───────────────────────────────────────────────────────────────────
-- TABLE: monthly_entries
-- Core data table. One row = one month of operational data.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facility_id     UUID REFERENCES facilities(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Reporting period
  report_month    DATE NOT NULL,         -- always the 1st of the month: 2025-03-01
  state_override  TEXT,                  -- if different from company.state

  -- Scope 2: Electricity (kWh)
  electricity_kwh   NUMERIC(12,2) DEFAULT 0,
  solar_kwh         NUMERIC(12,2) DEFAULT 0,   -- on-site solar generation (offsets grid)
  rec_kwh           NUMERIC(12,2) DEFAULT 0,   -- renewable energy certificates

  -- Scope 1: Fuels (litres or kg as per emission_factors.unit)
  fuel_diesel       NUMERIC(12,2) DEFAULT 0,
  fuel_lpg          NUMERIC(12,2) DEFAULT 0,
  fuel_coal         NUMERIC(12,2) DEFAULT 0,
  fuel_petrol       NUMERIC(12,2) DEFAULT 0,
  fuel_cng          NUMERIC(12,2) DEFAULT 0,
  fuel_furnace_oil  NUMERIC(12,2) DEFAULT 0,

  -- Scope 3 Cat 1: Raw materials (tonnes)
  mat_steel         NUMERIC(12,3) DEFAULT 0,
  mat_cement        NUMERIC(12,3) DEFAULT 0,
  mat_aluminum      NUMERIC(12,3) DEFAULT 0,
  mat_copper        NUMERIC(12,3) DEFAULT 0,
  mat_plastic       NUMERIC(12,3) DEFAULT 0,
  mat_paper         NUMERIC(12,3) DEFAULT 0,
  mat_glass         NUMERIC(12,3) DEFAULT 0,
  mat_rubber        NUMERIC(12,3) DEFAULT 0,

  -- Business context
  revenue_cr        NUMERIC(12,4),       -- ₹ crore revenue (for intensity calc)
  production_units  NUMERIC(12,2),       -- physical output (for intensity calc)
  production_unit_label TEXT,            -- 'tonnes', 'pieces', 'MT', etc.

  -- Computed results (stored for performance & audit trail)
  scope1_tco2e      NUMERIC(12,4),
  scope2_tco2e      NUMERIC(12,4),
  scope3_tco2e      NUMERIC(12,4),
  total_tco2e       NUMERIC(12,4),

  -- Status
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','verified')),
  notes             TEXT,

  UNIQUE(company_id, facility_id, report_month)
);

CREATE TRIGGER monthly_entries_updated_at
  BEFORE UPDATE ON monthly_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_entries_company_month ON monthly_entries(company_id, report_month DESC);


-- ───────────────────────────────────────────────────────────────────
-- TABLE: logistics_entries
-- One-to-many with monthly_entries (multiple routes per month)
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logistics_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES monthly_entries(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL DEFAULT 'road' CHECK (mode IN ('road','rail','air','sea')),
  description     TEXT,
  tonnes          NUMERIC(10,2) DEFAULT 0,
  distance_km     NUMERIC(10,1) DEFAULT 0,
  tco2e           NUMERIC(10,4)
);


-- ───────────────────────────────────────────────────────────────────
-- TABLE: recommendations
-- Persisted recommendation snapshots per entry.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_id        UUID REFERENCES monthly_entries(id) ON DELETE SET NULL,

  priority        TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  annual_co2_save NUMERIC(10,2),
  annual_cost_save NUMERIC(12,0),
  payback_months  INTEGER,
  difficulty      TEXT CHECK (difficulty IN ('Easy','Medium','Hard')),
  tags            TEXT[],
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','dismissed')),
  notes           TEXT
);


-- ───────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Users can only see data that belongs to their company.
-- ───────────────────────────────────────────────────────────────────

ALTER TABLE companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_factors    ENABLE ROW LEVEL SECURITY;

-- Helper: get the company_id of the currently authenticated user
CREATE OR REPLACE FUNCTION my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- emission_factors: read-only for all authenticated users
CREATE POLICY "emission_factors_read" ON emission_factors
  FOR SELECT TO authenticated USING (true);

-- companies: members can read + update their own company
CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated USING (id = my_company_id());
CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated USING (id = my_company_id());

-- profiles: users manage their own profile
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR company_id = my_company_id());
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- facilities: company members can CRUD their facilities
CREATE POLICY "facilities_all" ON facilities
  FOR ALL TO authenticated USING (company_id = my_company_id());

-- monthly_entries: company members can CRUD their entries
CREATE POLICY "entries_all" ON monthly_entries
  FOR ALL TO authenticated USING (company_id = my_company_id());

-- logistics_entries: accessible if parent entry is accessible
CREATE POLICY "logistics_all" ON logistics_entries
  FOR ALL TO authenticated
  USING (entry_id IN (SELECT id FROM monthly_entries WHERE company_id = my_company_id()));

-- recommendations: company-scoped
CREATE POLICY "recs_all" ON recommendations
  FOR ALL TO authenticated USING (company_id = my_company_id());


-- ───────────────────────────────────────────────────────────────────
-- VIEW: entry_totals
-- Convenience view joining entries + company state for dashboards
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW entry_totals AS
SELECT
  e.id,
  e.company_id,
  e.report_month,
  e.total_tco2e,
  e.scope1_tco2e,
  e.scope2_tco2e,
  e.scope3_tco2e,
  e.revenue_cr,
  CASE WHEN e.revenue_cr > 0 THEN ROUND(e.total_tco2e / e.revenue_cr, 4) END AS intensity_per_cr,
  e.status,
  c.name AS company_name,
  c.state,
  c.industry
FROM monthly_entries e
JOIN companies c ON c.id = e.company_id;
