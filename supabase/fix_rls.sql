-- ═══════════════════════════════════════════════
-- CarbonLens — RLS Full Reset
-- Run this in Supabase SQL Editor → New Query
-- ═══════════════════════════════════════════════

-- Drop ALL existing policies on companies and profiles
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'companies' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON companies';
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
  END LOOP;
END $$;

-- COMPANIES: full CRUD for authenticated users on their own company
CREATE POLICY "companies_insert" ON companies
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "companies_select" ON companies
  FOR SELECT TO authenticated USING (id = my_company_id());

CREATE POLICY "companies_update" ON companies
  FOR UPDATE TO authenticated USING (id = my_company_id());

-- PROFILES: users manage their own row
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = my_company_id());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('companies', 'profiles')
ORDER BY tablename, cmd;
