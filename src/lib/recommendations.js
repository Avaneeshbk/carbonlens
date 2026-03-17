import { GRID_EF } from './emissionFactors'
import { scoreRecommendations } from './mlScoring'

const ELEC_RATE  = 8.5
const DIESEL_RATE = 97

// ── Rule catalogue ────────────────────────────────────────────────
function buildRules(entry, calcResult, company) {
  const gef     = GRID_EF[company.state] || 0.82
  const diesel  = parseFloat(entry.fuel_diesel)      || 0
  const coal    = parseFloat(entry.fuel_coal)         || 0
  const elec    = parseFloat(entry.electricity_kwh)   || 0
  const steel   = parseFloat(entry.mat_steel)         || 0

  return [
    {
      id: 'solar-hybrid',
      trigger: () => diesel > 400,
      generate: () => {
        const annCO2  = parseFloat((diesel * 12 * 2.68 / 1000 * 0.75).toFixed(1))
        const annCost = Math.round(diesel * 12 * DIESEL_RATE * 0.45)
        const dieselPct = calcResult.total > 0
          ? (diesel * 2.68 / 1000 / calcResult.total * 100).toFixed(0) : 0
        return {
          id:'solar-hybrid', cat:'Fuel Switch',
          title:'Replace diesel generators with grid + solar hybrid',
          desc:`Diesel consumes ${diesel.toLocaleString()}L/month — ${dieselPct}% of Scope 1. Solar + battery backup eliminates 70–80% of diesel dependency. PM-KUSUM Component C subsidies applicable in ${company.state}.`,
          co2Save:annCO2, costSave:annCost, paybackMonths:15, difficulty:'Medium',
          tags:['Scope 1','Capital Required','Subsidy Available'],
        }
      },
    },
    {
      id: 'led-vfd',
      trigger: () => elec > 8000,
      generate: () => {
        const co2Save  = parseFloat((elec * 0.20 * gef * 12 / 1000).toFixed(1))
        const costSave = Math.round(elec * 0.20 * 12 * ELEC_RATE)
        return {
          id:'led-vfd', cat:'Energy Efficiency',
          title:'LED retrofit + Variable Frequency Drives on motors',
          desc:`LED lighting cuts lighting load 60–70%. VFDs on pumps and compressors reduce motor draw 20–40%. Combined: ~20% electricity reduction with 8–14 month payback. Zero production disruption.`,
          co2Save, costSave, paybackMonths:11, difficulty:'Easy',
          tags:['Scope 2','Quick ROI','MSME Scheme'],
        }
      },
    },
    {
      id: 'coal-to-png',
      trigger: () => coal > 500,
      generate: () => {
        const co2Save  = parseFloat((coal * 12 * 2.42 * 0.55 / 1000).toFixed(1))
        const costSave = Math.round(co2Save * 2500)
        return {
          id:'coal-to-png', cat:'Fuel Switch',
          title:'Convert coal boilers to PNG or certified biomass pellets',
          desc:`Coal at 2.42 kg CO₂/kg is the highest-emission boiler fuel. PNG conversion cuts Scope 1 boiler emissions by 55%. Certified biomass pellets qualify as carbon-neutral under IPCC Tier 1.`,
          co2Save, costSave, paybackMonths:20, difficulty:'Hard',
          tags:['Scope 1','High Impact'],
        }
      },
    },
    {
      id: 'rooftop-solar',
      trigger: () => elec > 5000,
      generate: () => {
        const kW      = Math.max(10, Math.round(elec * 0.28 / 120))
        const annGen  = kW * 120 * 12
        const co2Save = parseFloat((annGen * gef / 1000).toFixed(1))
        const costSave = Math.round(annGen * ELEC_RATE)
        return {
          id:'rooftop-solar', cat:'Renewable Energy',
          title:`${kW} kW rooftop solar PV installation`,
          desc:`A ${kW} kW system covers ~28% of current demand. MNRE MSME subsidy: 40% for ≤3kW, 20% for 3–10kW. 40% accelerated depreciation available. Net metering active in ${company.state}.`,
          co2Save, costSave, paybackMonths:54, difficulty:'Medium',
          tags:['Scope 2','MNRE Subsidy','Net Metering'],
        }
      },
    },
    {
      id: 'whr-unit',
      trigger: () => calcResult.scope1 > 4,
      generate: () => {
        const co2Save  = parseFloat((calcResult.scope1 * 12 * 0.18).toFixed(1))
        const costSave = Math.round(co2Save * 2800)
        return {
          id:'whr-unit', cat:'Process Efficiency',
          title:'Waste heat recovery unit on boiler / furnace flue gas',
          desc:`Flue gas heat recovery recaptures 15–25% of fuel energy currently vented. Reduces fuel consumption proportionally. Applicable to boilers >5 t/hr or furnaces >500 kW thermal input.`,
          co2Save, costSave, paybackMonths:24, difficulty:'Hard',
          tags:['Scope 1','Process Heat'],
        }
      },
    },
    {
      id: 'eaf-steel',
      trigger: () => steel > 5,
      generate: () => {
        const co2Save  = parseFloat((steel * 12 * 1.2).toFixed(1))
        const costSave = Math.round(steel * 12 * 800)
        return {
          id:'eaf-steel', cat:'Supply Chain',
          title:'Switch to EAF-route recycled steel from certified suppliers',
          desc:`EAF steel from scrap: ~600 kg CO₂/tonne vs 1,800 kg for virgin BF-BOF — 67% reduction. JSPL, JSW and Tata Steel supply EAF secondary steel with EPD documentation. No process changes required.`,
          co2Save, costSave, paybackMonths:0, difficulty:'Medium',
          tags:['Scope 3','Supply Chain','No CAPEX'],
        }
      },
    },
    {
      id: 'tou-tariff',
      trigger: () => elec > 6000,
      generate: () => {
        const costSave = Math.round(elec * 0.18 * 12 * 2.1)
        return {
          id:'tou-tariff', cat:'Quick Win',
          title:'Time-of-Use tariff + off-peak process scheduling',
          desc:`Shifting high-load processes to 10pm–6am on ToU tariff saves ₹1.8–2.8/unit vs peak rates. Zero capital. Apply via DISCOM portal. Fully reversible operational change.`,
          co2Save:0, costSave, paybackMonths:0, difficulty:'Easy',
          tags:['Scope 2','Zero CAPEX','Immediate'],
        }
      },
    },
    {
      id: 'iso14064',
      trigger: () => true,
      generate: () => ({
        id:'iso14064', cat:'Certification',
        title:'ISO 14064 third-party verification — Bureau Veritas / TÜV',
        desc:`Third-party verification transforms your GHG inventory into an auditable, bankable asset. Required for EU CBAM submission and SEBI BRSR top-250. Bureau Veritas and TÜV SÜD have India MSME packages.`,
        co2Save:0, costSave:0, paybackMonths:null, difficulty:'Easy',
        tags:['EU CBAM','BRSR Ready','Buyer Trust'],
      }),
    },
  ]
}

// ── Main export ───────────────────────────────────────────────────
export function generateRecommendations(latestEntry, calcResult, company) {
  const rules = buildRules(latestEntry, calcResult, company)

  // 1. Run trigger conditions
  const triggered = rules
    .filter(r => { try { return r.trigger() } catch { return false } })
    .map(r => r.generate())

  // 2. Score with ML engine (multi-factor + Monte Carlo)
  const scored = scoreRecommendations(triggered, calcResult, latestEntry, company)

  return scored
}
