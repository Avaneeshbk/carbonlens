# 🌿 CarbonLens — India SME Carbon Tracking Platform

GHG Protocol-aligned carbon footprint tracking for Indian manufacturers.
Scope 1 + 2 + 3 calculation, CEA 2024 state grid factors, SEBI BRSR reporting, EU CBAM ready.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (Postgres + Auth + Realtime + RLS) |
| Charts | Chart.js + react-chartjs-2 |
| Routing | React Router v6 |
| Date handling | date-fns |

---

## Project Structure

```
carbonlens/
├── supabase/
│   ├── schema.sql          ← Run this first in Supabase SQL Editor
│   └── seed.sql            ← Optional: demo data for development
│
├── src/
│   ├── lib/
│   │   ├── supabase.js         ← Supabase client singleton
│   │   ├── emissionFactors.js  ← CEA 2024, IPCC AR6, GLEC v2 factors
│   │   ├── calculations.js     ← GHG Protocol calculation engine (pure functions)
│   │   └── recommendations.js  ← Rule-based recommendation engine
│   │
│   ├── hooks/
│   │   ├── useAuth.js          ← Auth state + company profile
│   │   └── useEntries.js       ← Monthly entries CRUD + realtime + calc
│   │
│   ├── components/
│   │   ├── layout/Layout.jsx           ← Sidebar + nav
│   │   ├── auth/LoginPage.jsx          ← Sign in / sign up
│   │   ├── auth/OnboardingPage.jsx     ← Company setup wizard
│   │   ├── dashboard/Dashboard.jsx     ← KPIs, trend chart, breakdown
│   │   ├── data-entry/DataEntry.jsx    ← Monthly data form + live calc
│   │   ├── recommendations/            ← Reduction action plan
│   │   ├── report/Report.jsx           ← GHG Protocol + BRSR report
│   │   └── ui/index.jsx                ← Reusable components
│   │
│   ├── styles/globals.css
│   ├── App.jsx             ← Routes + auth guard
│   └── main.jsx            ← Entry point
│
├── .env.example            ← Copy this to .env
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## Setup — Step by Step

### Step 1: Install Node.js

Download and install from https://nodejs.org (LTS version, currently 20.x).

Verify:
```bash
node --version   # should print v20.x.x
npm --version    # should print 10.x.x
```

### Step 2: Create a Supabase project

1. Go to https://app.supabase.com
2. Click **New Project**
3. Name it `carbonlens`, choose a strong DB password, pick the **South Asia (Mumbai)** region
4. Wait ~2 minutes for provisioning

### Step 3: Run the database schema

1. In Supabase dashboard → **SQL Editor** → **New Query**
2. Copy the entire contents of `supabase/schema.sql`
3. Paste and click **Run**
4. You should see "Success. No rows returned."

### Step 4: (Optional) Load demo data

If you want to start with Mehta Auto Components sample data:
1. First create a user: Supabase dashboard → **Authentication** → **Users** → **Invite User**
2. Open `supabase/seed.sql`, find the UPDATE statement at the bottom
3. Replace `YOUR-AUTH-USER-UUID` with the UUID of the user you just created
4. Run `seed.sql` in SQL Editor

### Step 5: Get your API keys

Supabase dashboard → **Project Settings** → **API**

Copy:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — long JWT string

### Step 6: Configure environment

```bash
# In the carbonlens project root
cp .env.example .env
```

Open `.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Step 7: Install dependencies and run

```bash
cd carbonlens
npm install
npm run dev
```

Open http://localhost:5173

### Step 8: Create your first account

1. Go to http://localhost:5173/login
2. Click **Sign up free**
3. Enter name, email, password → **Create Account**
4. Check your email for confirmation link (or disable email confirmation in Supabase: **Authentication** → **Settings** → toggle off **Enable email confirmations**)
5. Sign in → you'll be taken through the onboarding wizard to set up your company

---

## Supabase: Disable Email Confirmation (dev only)

For faster development, turn off email confirmation:
Supabase → **Authentication** → **Settings** → **Email Auth** → disable **Confirm email**

---

## How the Calculation Engine Works

All calculation logic is in `src/lib/calculations.js`. Pure functions, no side effects.

```
Monthly entry data (from DB)
        ↓
calcScope1(entry)         → Scope 1 tCO2e (fuel combustion × IPCC AR6 EF)
calcScope2(entry, state)  → Scope 2 tCO2e ((kWh - solar - REC) × CEA 2024 state EF)
calcScope3Materials(entry)→ Scope 3 Cat 1 tCO2e (material tonnes × Ecoinvent 3.9 EF)
calcScope3Logistics(rows) → Scope 3 Cat 4/9 tCO2e (tonne-km × GLEC v2 EF)
        ↓
calculateEmissions()      → { scope1, scope2, scope3, total, sources, intensity, meta }
```

Computed values are also written back to `monthly_entries.scope1_tco2e` etc. for audit trail and fast dashboard queries.

---

## Row Level Security

Every table has RLS enabled. The helper function `my_company_id()` returns the company linked to the current authenticated user. All queries are automatically filtered to the user's company — Company A cannot see Company B's data.

---

## Emission Factor Database

Factors are seeded in `supabase/schema.sql` and also mirrored as constants in `src/lib/emissionFactors.js` (used for client-side live calculation).

| Source | Coverage |
|---|---|
| CEA Annual Report 2024 | Grid EF for 22 India states/UTs |
| IPCC AR6 Table A.II.4 | 6 fuel types (diesel, LPG, coal, petrol, CNG, furnace oil) |
| Ecoinvent 3.9 | 8 raw materials (steel, cement, aluminum, copper, plastic, paper, glass, rubber) |
| GLEC Framework v2 | 4 logistics modes (road, rail, air, sea) |

Update the `emission_factors` table in Supabase when CEA publishes new annual factors (usually November).

---

## Roadmap

### Phase 2 (next)
- [ ] OCR bill upload → auto-extract kWh (Google Cloud Vision API)
- [ ] Multi-facility support (Professional plan)
- [ ] Supplier carbon data collection module
- [ ] PDF report download (Puppeteer or pdf-lib)
- [ ] Email scheduled reports

### Phase 3
- [ ] ML recommendation ranking (train on anonymised SME data corpus)
- [ ] GRI 305 export format
- [ ] ERP integration (Tally, Zoho Books API)
- [ ] Carbon market / offset integration
- [ ] Mobile app (React Native)

---

## Build for Production

```bash
npm run build
# Output in /dist — deploy to Vercel, Netlify, or any static host
```

For Vercel:
```bash
npx vercel --prod
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel environment variables
```

---

## License

Private — CarbonLens prototype. Not for redistribution.
# carbonlens
# carbonlens
