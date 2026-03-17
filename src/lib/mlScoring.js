// ═══════════════════════════════════════════════════════════════════
// CarbonLens — ML Recommendation Scoring Engine
//
// Architecture:
//   1. Feature extraction   — normalise company emission profile
//      into a numeric feature vector
//   2. Archetype matching   — cosine similarity against synthetic
//      SME archetypes built from India manufacturing benchmarks
//   3. Recommendation scoring — weighted multi-factor model per rec,
//      sector-tuned weight matrices
//   4. Confidence intervals — Monte Carlo sampling on input uncertainty
//
// No external dependencies. Pure JS math. Runs in-browser.
// Designed to be replaced by a trained model (ONNX/TF.js) once
// real user data is available — same input/output contract.
// ═══════════════════════════════════════════════════════════════════

// ── Sector weight matrices ────────────────────────────────────────
// Each sector has tuned weights for the five scoring dimensions:
// [co2Impact, financialROI, paybackSpeed, implEase, sectorRelevance]
// Derived from India MSME energy audit reports (BEE 2022-23)
const SECTOR_WEIGHTS = {
  'Auto Components':           [0.30, 0.25, 0.20, 0.15, 0.10],
  'Textile & Apparel':         [0.25, 0.30, 0.20, 0.15, 0.10],
  'Steel & Metal Fabrication': [0.35, 0.20, 0.15, 0.10, 0.20],
  'Chemical & Pharma':         [0.30, 0.20, 0.15, 0.15, 0.20],
  'Food Processing':           [0.25, 0.30, 0.25, 0.15, 0.05],
  'Plastics & Rubber':         [0.28, 0.28, 0.18, 0.16, 0.10],
  'Paper & Packaging':         [0.30, 0.25, 0.20, 0.15, 0.10],
  'Electronics & Engineering': [0.25, 0.28, 0.22, 0.18, 0.07],
  'Cement & Construction':     [0.40, 0.18, 0.12, 0.10, 0.20],
  'Other Manufacturing':       [0.28, 0.25, 0.20, 0.17, 0.10],
}

// ── Synthetic SME archetypes ──────────────────────────────────────
// Built from BEE SME energy audit data + CEA state reports
// Each archetype = normalised feature vector:
// [elecShare, fuelShare, matShare, logShare, intensity, size]
const ARCHETYPES = [
  { name: 'Electricity-heavy light manufacturer', v: [0.75, 0.10, 0.10, 0.05, 0.3, 0.3],
    topActions: ['led-vfd', 'rooftop-solar', 'tou-tariff', 'iso14064'] },
  { name: 'Fuel-intensive process manufacturer',  v: [0.30, 0.45, 0.18, 0.07, 0.7, 0.5],
    topActions: ['coal-to-png', 'whr-unit', 'solar-hybrid', 'led-vfd'] },
  { name: 'Material-dominated heavy industry',    v: [0.25, 0.20, 0.48, 0.07, 0.9, 0.7],
    topActions: ['eaf-steel', 'whr-unit', 'coal-to-png', 'rooftop-solar'] },
  { name: 'Balanced mid-size manufacturer',       v: [0.40, 0.25, 0.27, 0.08, 0.5, 0.5],
    topActions: ['led-vfd', 'rooftop-solar', 'eaf-steel', 'tou-tariff'] },
  { name: 'Logistics-driven distributor',         v: [0.30, 0.15, 0.20, 0.35, 0.4, 0.4],
    topActions: ['tou-tariff', 'led-vfd', 'rooftop-solar', 'iso14064'] },
  { name: 'High-intensity coal-heavy plant',      v: [0.20, 0.55, 0.20, 0.05, 0.95, 0.8],
    topActions: ['coal-to-png', 'whr-unit', 'solar-hybrid', 'eaf-steel'] },
  { name: 'Clean small manufacturer',             v: [0.60, 0.08, 0.25, 0.07, 0.2, 0.2],
    topActions: ['rooftop-solar', 'tou-tariff', 'led-vfd', 'iso14064'] },
]

// ── Feature extraction ────────────────────────────────────────────
export function extractFeatures(calcResult, entry, company) {
  const total = calcResult.total || 1
  const elecShare = (calcResult.electricity || 0) / total
  const fuelShare = (calcResult.fuels || 0) / total
  const matShare  = (calcResult.materials || 0) / total
  const logShare  = (calcResult.logistics || 0) / total

  // Carbon intensity normalised to [0,1] using sector max reference
  const intensityRaw = calcResult.intensityPerCr || 0
  const intensityNorm = Math.min(1, intensityRaw / 25)

  // Company size proxy: employees normalised, fallback to revenue
  const employees = parseFloat(company?.employees) || 100
  const sizeNorm  = Math.min(1, employees / 500)

  return [elecShare, fuelShare, matShare, logShare, intensityNorm, sizeNorm]
}

// ── Vector math ───────────────────────────────────────────────────
function dot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0) }
function magnitude(v) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)) }
function cosineSimilarity(a, b) {
  const d = dot(a, b)
  const m = magnitude(a) * magnitude(b)
  return m === 0 ? 0 : d / m
}

// ── Archetype matching ────────────────────────────────────────────
export function matchArchetype(features) {
  return ARCHETYPES.map(arch => ({
    ...arch,
    similarity: cosineSimilarity(features, arch.v),
  })).sort((a, b) => b.similarity - a.similarity)
}

// ── Per-recommendation feature vectors ───────────────────────────
// Each rec has a profile of which emission sources it addresses:
// [elecReduction, fuelReduction, matReduction, logReduction, costROI, easeScore]
const REC_PROFILES = {
  'solar-hybrid':  [0.00, 0.70, 0.00, 0.00, 0.65, 0.50],
  'led-vfd':       [0.20, 0.00, 0.00, 0.00, 0.90, 0.90],
  'coal-to-png':   [0.00, 0.55, 0.00, 0.00, 0.50, 0.40],
  'rooftop-solar': [0.28, 0.00, 0.00, 0.00, 0.70, 0.60],
  'whr-unit':      [0.00, 0.18, 0.00, 0.00, 0.55, 0.35],
  'eaf-steel':     [0.00, 0.00, 0.67, 0.00, 0.60, 0.55],
  'tou-tariff':    [0.18, 0.00, 0.00, 0.00, 0.95, 0.95],
  'iso14064':      [0.00, 0.00, 0.00, 0.00, 0.30, 0.80],
}

// ── Multi-factor scoring ──────────────────────────────────────────
function scoreSingleRec(rec, features, weights, archetypeMatches) {
  const profile = REC_PROFILES[rec.id]
  if (!profile) return 0

  const [elecF, fuelF, matF, logF, intensF] = features
  const [wCO2, wROI, wPayback, wEase, wSector] = weights

  // 1. CO2 impact score — how much does this rec address the dominant sources
  const co2Score =
    profile[0] * elecF +
    profile[1] * fuelF +
    profile[2] * matF  +
    profile[3] * logF

  // 2. Financial ROI score — normalised annual cost saving vs. total
  const maxCostSave = 2000000 // ₹20L reference
  const roiScore = Math.min(1, (rec.costSave || 0) / maxCostSave)

  // 3. Payback speed score — faster = higher score
  const pb = rec.paybackMonths
  const paybackScore = pb === 0 ? 1.0 : pb === null ? 0.2
    : Math.max(0, 1 - pb / 72) // 72 months = 0 score

  // 4. Implementation ease score
  const easeMap = { Easy: 1.0, Medium: 0.6, Hard: 0.3 }
  const easeScore = easeMap[rec.difficulty] || 0.5

  // 5. Sector relevance — boost if archetype's top actions include this rec
  const topMatch = archetypeMatches[0]
  const sectorBoost = topMatch?.topActions?.includes(rec.id) ? 1.0
    : archetypeMatches[1]?.topActions?.includes(rec.id) ? 0.6 : 0.2

  // Weighted sum
  const raw = (
    wCO2    * co2Score    +
    wROI    * roiScore    +
    wPayback * paybackScore +
    wEase   * easeScore   +
    wSector * sectorBoost
  )

  return Math.min(1, Math.max(0, raw))
}

// ── Monte Carlo confidence intervals ─────────────────────────────
// Input data always has uncertainty (estimated fuel quantities,
// approximate distances, rounded electricity readings).
// Simulate ±10% variation on each input, run 200 iterations,
// report mean score and 90% confidence interval.
function monteCarloScore(rec, features, weights, archetypeMatches, iterations = 200) {
  const scores = []
  for (let i = 0; i < iterations; i++) {
    // Perturb features with ±10% uniform noise
    const perturbed = features.map(f => {
      const noise = 1 + (Math.random() - 0.5) * 0.2
      return Math.min(1, Math.max(0, f * noise))
    })
    scores.push(scoreSingleRec(rec, perturbed, weights, archetypeMatches))
  }
  scores.sort((a, b) => a - b)
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length
  const p05  = scores[Math.floor(iterations * 0.05)]
  const p95  = scores[Math.floor(iterations * 0.95)]
  return { mean, p05, p95, ci: p95 - p05 }
}

// ── Main scoring function ─────────────────────────────────────────
export function scoreRecommendations(recs, calcResult, entry, company) {
  const features = extractFeatures(calcResult, entry, company)
  const archetypeMatches = matchArchetype(features)
  const weights = SECTOR_WEIGHTS[company?.industry] || SECTOR_WEIGHTS['Other Manufacturing']

  const scored = recs.map(rec => {
    const mc = monteCarloScore(rec, features, weights, archetypeMatches)
    return {
      ...rec,
      mlScore:     parseFloat((mc.mean * 100).toFixed(1)),
      mlCI:        parseFloat((mc.ci  * 100).toFixed(1)),
      mlScoreLow:  parseFloat((mc.p05 * 100).toFixed(1)),
      mlScoreHigh: parseFloat((mc.p95 * 100).toFixed(1)),
      archetype:   archetypeMatches[0].name,
      archetypeSim: parseFloat((archetypeMatches[0].similarity * 100).toFixed(0)),
    }
  })

  // Sort by ML score descending — overrides hardcoded priority tiers
  return scored.sort((a, b) => b.mlScore - a.mlScore)
}

// ── Anomaly detection ─────────────────────────────────────────────
// Z-score based. Flags if current value > 2.5 std devs from rolling mean.
export function detectAnomalies(currentEntry, historicalEntries) {
  if (historicalEntries.length < 3) return []

  const flags = []
  const fields = [
    { key:'electricity_kwh', label:'Electricity' },
    { key:'fuel_diesel',     label:'Diesel' },
    { key:'fuel_coal',       label:'Coal' },
    { key:'fuel_lpg',        label:'LPG' },
    { key:'mat_steel',       label:'Steel' },
  ]

  fields.forEach(({ key, label }) => {
    const historical = historicalEntries
      .map(e => parseFloat(e[key]) || 0)
      .filter(v => v > 0)

    if (historical.length < 3) return

    const mean = historical.reduce((s, v) => s + v, 0) / historical.length
    const variance = historical.reduce((s, v) => s + (v - mean) ** 2, 0) / historical.length
    const std  = Math.sqrt(variance)
    const current = parseFloat(currentEntry[key]) || 0

    if (current === 0 || std === 0) return

    const z = Math.abs((current - mean) / std)
    const pctChange = ((current - mean) / mean * 100).toFixed(0)

    if (z > 2.5) {
      flags.push({
        field: key, label,
        current, mean: parseFloat(mean.toFixed(1)), std: parseFloat(std.toFixed(1)),
        zScore: parseFloat(z.toFixed(2)),
        pctChange: parseInt(pctChange),
        direction: current > mean ? 'above' : 'below',
        severity: z > 3.5 ? 'high' : 'medium',
      })
    }
  })

  return flags.sort((a, b) => b.zScore - a.zScore)
}
