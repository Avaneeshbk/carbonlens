// ═══════════════════════════════════════════════════════════════════
// Emission Factor Database
// Primary source: Supabase emission_factors table (dynamically loaded)
// Fallback: hardcoded constants below (matches schema seed data)
//
// Sources:
//   - Grid EF: CEA Annual Report 2024
//   - Fuel EF: IPCC AR6 Table A.II.4
//   - Material EF: Ecoinvent 3.9 / GHG Protocol Product Standard
//   - Logistics EF: GLEC Framework v2 / MoRTH 2023
// ═══════════════════════════════════════════════════════════════════

export const GRID_EF = {
  'Andhra Pradesh':    0.79,
  'Bihar':             0.91,
  'Chhattisgarh':      0.98,
  'Delhi':             0.82,
  'Goa':               0.71,
  'Gujarat':           0.85,
  'Haryana':           0.84,
  'Himachal Pradesh':  0.26,
  'Jharkhand':         0.97,
  'Karnataka':         0.74,
  'Kerala':            0.49,
  'Madhya Pradesh':    0.94,
  'Maharashtra':       0.82,
  'Odisha':            0.87,
  'Punjab':            0.74,
  'Rajasthan':         0.92,
  'Tamil Nadu':        0.71,
  'Telangana':         0.83,
  'Uttar Pradesh':     0.93,
  'Uttarakhand':       0.33,
  'West Bengal':       0.87,
  'Other':             0.82,
}

export const INDIA_STATES = Object.keys(GRID_EF)

export const FUEL_EF = {
  diesel:     { ef: 2.68,  unit: 'litres', label: 'Diesel (Generator / Vehicle)' },
  lpg:        { ef: 1.51,  unit: 'litres', label: 'LPG / Propane' },
  coal:       { ef: 2.42,  unit: 'kg',     label: 'Coal (Thermal)' },
  petrol:     { ef: 2.31,  unit: 'litres', label: 'Petrol' },
  cng:        { ef: 2.21,  unit: 'kg',     label: 'CNG / Natural Gas' },
  furnaceOil: { ef: 3.15,  unit: 'litres', label: 'Furnace Oil / HFO' },
}

export const MATERIAL_EF = {
  steel:    { ef: 1800, unit: 'tonnes', label: 'Steel / Iron' },
  cement:   { ef: 820,  unit: 'tonnes', label: 'Cement / Concrete' },
  aluminum: { ef: 8900, unit: 'tonnes', label: 'Aluminum' },
  copper:   { ef: 3900, unit: 'tonnes', label: 'Copper' },
  plastic:  { ef: 1900, unit: 'tonnes', label: 'Plastics (mixed)' },
  paper:    { ef: 900,  unit: 'tonnes', label: 'Paper / Cardboard' },
  glass:    { ef: 850,  unit: 'tonnes', label: 'Glass' },
  rubber:   { ef: 2900, unit: 'tonnes', label: 'Rubber (synthetic)' },
}

export const LOGISTICS_EF = {
  road: { ef: 0.096, label: 'Road (Diesel Truck)' },
  rail: { ef: 0.028, label: 'Rail (Indian Railways)' },
  air:  { ef: 0.602, label: 'Air Freight' },
  sea:  { ef: 0.016, label: 'Sea / Coastal Barge' },
}

export const SECTOR_BENCHMARKS = {
  'Textile & Apparel':           4.2,
  'Auto Components':             6.8,
  'Steel & Metal Fabrication':  18.5,
  'Chemical & Pharma':           9.2,
  'Food Processing':             3.1,
  'Plastics & Rubber':           7.4,
  'Paper & Packaging':           8.9,
  'Electronics & Engineering':   3.6,
  'Cement & Construction':      22.1,
  'Other Manufacturing':         7.0,
}

export const INDUSTRY_SECTORS = Object.keys(SECTOR_BENCHMARKS)
