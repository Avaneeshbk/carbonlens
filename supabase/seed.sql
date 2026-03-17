-- ═══════════════════════════════════════════════════════════════════
-- CarbonLens — Seed Data (Development only)
-- Run AFTER schema.sql
-- Creates a demo company + 6 months of entries for testing
-- NOTE: You must create the auth user manually in Supabase Auth UI
--       then set the UUID below before running this seed.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Create demo company
INSERT INTO companies (id, name, gstin, cin, address, state, industry, employees, plan, onboarding_complete)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Mehta Auto Components Pvt Ltd',
  '27AABCM1234A1Z5',
  'U28920MH2018PTC310421',
  'MIDC Bhosari Industrial Estate, Pune – 411026',
  'Maharashtra',
  'Auto Components',
  180,
  'professional',
  true
) ON CONFLICT DO NOTHING;

-- Step 2: Update your profile with this company_id
-- Replace 'YOUR-AUTH-USER-UUID' with the UUID from Supabase Auth Dashboard
-- UPDATE profiles SET company_id = 'aaaaaaaa-0000-0000-0000-000000000001', role = 'owner'
-- WHERE id = 'YOUR-AUTH-USER-UUID';

-- Step 3: Seed 6 months of monthly entries
INSERT INTO monthly_entries (company_id, report_month, electricity_kwh, fuel_diesel, fuel_lpg, fuel_coal, mat_steel, mat_plastic, mat_paper, mat_rubber, revenue_cr, scope1_tco2e, scope2_tco2e, scope3_tco2e, total_tco2e, status) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', '2024-10-01', 18500, 650, 200, 800, 12.5, 3.2, 1.8, 0.8, 9.8,  3.673, 15.170, 28.100, 46.943, 'submitted'),
('aaaaaaaa-0000-0000-0000-000000000001', '2024-11-01', 17200, 580, 210, 850, 11.8, 2.9, 2.1, 0.7, 9.2,  3.482, 14.104, 26.400, 43.986, 'submitted'),
('aaaaaaaa-0000-0000-0000-000000000001', '2024-12-01', 19800, 720, 185, 920, 14.2, 3.8, 2.4, 0.9, 11.2, 4.004, 16.236, 32.490, 52.730, 'submitted'),
('aaaaaaaa-0000-0000-0000-000000000001', '2025-01-01', 20100, 690, 195, 880, 13.5, 3.5, 2.2, 0.85,10.8, 3.840, 16.482, 30.795, 51.117, 'submitted'),
('aaaaaaaa-0000-0000-0000-000000000001', '2025-02-01', 18900, 610, 180, 810, 12.8, 3.1, 2.0, 0.75,10.1, 3.437, 15.498, 29.015, 47.950, 'submitted'),
('aaaaaaaa-0000-0000-0000-000000000001', '2025-03-01', 21500, 740, 220, 950, 15.1, 4.0, 2.6, 0.95,12.1, 4.142, 17.630, 34.375, 56.147, 'submitted')
ON CONFLICT DO NOTHING;
