// ═══════════════════════════════════════════════════════════════════
// CarbonLens — GHG Calculation Engine
// Standard: GHG Protocol Corporate Accounting & Reporting Standard
//
// All functions are pure (no side effects) — easy to unit test.
// Inputs: operational data from monthly_entries DB row
// Outputs: { scope1, scope2, scope3, total, breakdown }
// Units: tonnes CO2 equivalent (tCO2e)
// ═══════════════════════════════════════════════════════════════════

import { GRID_EF, FUEL_EF, MATERIAL_EF, LOGISTICS_EF } from './emissionFactors'

const kgToTonnes = (kg) => kg / 1000

/**
 * Calculate Scope 2 emissions from grid electricity.
 * Uses state-specific CEA 2024 grid emission factor.
 * Net electricity = consumed - solar generated - REC offset
 */
export function calcScope2(entry, state) {
  const gef = GRID_EF[state] || GRID_EF['Other']
  const consumed = parseFloat(entry.electricity_kwh) || 0
  const solar    = parseFloat(entry.solar_kwh)       || 0
  const rec      = parseFloat(entry.rec_kwh)          || 0
  const netKwh   = Math.max(0, consumed - solar - rec)
  return {
    total: parseFloat(kgToTonnes(netKwh * gef).toFixed(4)),
    gridEF: gef,
    netKwh,
    breakdown: { electricity: parseFloat(kgToTonnes(netKwh * gef).toFixed(4)) },
  }
}

/**
 * Calculate Scope 1 emissions from stationary + mobile combustion.
 * Applies IPCC AR6 fuel-specific emission factors.
 */
export function calcScope1(entry) {
  const breakdown = {}
  let total = 0
  Object.entries(FUEL_EF).forEach(([key, f]) => {
    const dbKey = key === 'furnaceOil' ? 'fuel_furnace_oil' : `fuel_${key}`
    const qty = parseFloat(entry[dbKey]) || 0
    if (qty > 0) {
      const tco2e = parseFloat(kgToTonnes(qty * f.ef).toFixed(4))
      breakdown[key] = tco2e
      total += tco2e
    }
  })
  return { total: parseFloat(total.toFixed(4)), breakdown }
}

/**
 * Calculate Scope 3 Category 1 from raw material embodied carbon.
 * Uses Ecoinvent 3.9 cradle-to-gate factors.
 */
export function calcScope3Materials(entry) {
  const breakdown = {}
  let total = 0
  Object.entries(MATERIAL_EF).forEach(([key, m]) => {
    const dbKey = `mat_${key}`
    const qty = parseFloat(entry[dbKey]) || 0
    if (qty > 0) {
      // Material EF is kg CO2e / tonne, qty already in tonnes
      const tco2e = parseFloat(kgToTonnes(qty * m.ef).toFixed(4))
      breakdown[key] = tco2e
      total += tco2e
    }
  })
  return { total: parseFloat(total.toFixed(4)), breakdown }
}

/**
 * Calculate Scope 3 Category 4/9 from freight logistics.
 * Uses GLEC Framework v2 tonne-km factors.
 */
export function calcScope3Logistics(logisticsRows = []) {
  const breakdown = []
  let total = 0
  logisticsRows.forEach((row) => {
    const ef = LOGISTICS_EF[row.mode]?.ef || LOGISTICS_EF.road.ef
    const tonnes = parseFloat(row.tonnes) || 0
    const km     = parseFloat(row.distance_km) || 0
    const tco2e  = parseFloat(kgToTonnes(tonnes * km * ef).toFixed(4))
    if (tco2e > 0) {
      breakdown.push({ ...row, tco2e })
      total += tco2e
    }
  })
  return { total: parseFloat(total.toFixed(4)), breakdown }
}

/**
 * Main calculation function.
 * Combines all scopes into a single result object.
 *
 * @param {Object} entry - monthly_entries row from Supabase
 * @param {string} state - company state (for grid EF lookup)
 * @param {Array}  logisticsRows - logistics_entries rows for this entry
 * @returns {Object} Full emissions breakdown
 */
export function calculateEmissions(entry, state, logisticsRows = []) {
  const s1 = calcScope1(entry)
  const s2 = calcScope2(entry, state)
  const s3m = calcScope3Materials(entry)
  const s3l = calcScope3Logistics(logisticsRows)

  const scope3Total = parseFloat((s3m.total + s3l.total).toFixed(4))
  const total = parseFloat((s1.total + s2.total + scope3Total).toFixed(4))

  const revenueCr = parseFloat(entry.revenue_cr) || 0

  return {
    scope1: s1.total,
    scope2: s2.total,
    scope3: scope3Total,
    total,

    // Detailed breakdowns
    scope1Breakdown: s1.breakdown,
    scope2Breakdown: s2.breakdown,
    scope3Materials: s3m.breakdown,
    scope3Logistics: s3l.breakdown,

    // Top-level source contributions
    sources: {
      electricity: s2.total,
      fuels:       s1.total,
      materials:   s3m.total,
      logistics:   s3l.total,
    },

    // Intensity metrics
    intensityPerCr:          revenueCr > 0 ? parseFloat((total / revenueCr).toFixed(3)) : null,
    intensityPerProductUnit: null, // TODO: implement when production_units added

    // Methodology metadata
    meta: {
      state,
      gridEF: s2.gridEF,
      netKwh: s2.netKwh,
      standard: 'GHG Protocol Corporate Standard (Revised)',
      gridSource: 'CEA Annual Report 2024',
    },
  }
}

/**
 * Calculate totals over an array of (calc result, entry) pairs.
 * Used for period-aggregate dashboard values.
 */
export function sumEmissions(calcResults) {
  return calcResults.reduce(
    (acc, r) => ({
      scope1: parseFloat((acc.scope1 + r.scope1).toFixed(4)),
      scope2: parseFloat((acc.scope2 + r.scope2).toFixed(4)),
      scope3: parseFloat((acc.scope3 + r.scope3).toFixed(4)),
      total:  parseFloat((acc.total  + r.total).toFixed(4)),
    }),
    { scope1: 0, scope2: 0, scope3: 0, total: 0 }
  )
}

/**
 * Month-over-month percentage change.
 */
export function calcMoMChange(current, previous) {
  if (!previous || previous === 0) return null
  return parseFloat(((current - previous) / previous * 100).toFixed(1))
}
