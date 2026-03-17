// ═══════════════════════════════════════════════════════════════════
// CarbonLens — OCR Bill Processor v3
// Handles BESCOM, MSEDCL, TNEB, UPPCL and mixed Kannada/English bills
// Key fix: anchor extraction to consumption line, not largest number
// ═══════════════════════════════════════════════════════════════════

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

async function loadTesseract() {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js')
  if (!window.Tesseract) throw new Error('Tesseract not initialised')
  return window.Tesseract
}

async function loadPdfJs() {
  await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js')
  if (!window.pdfjsLib) throw new Error('pdf.js not initialised')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
  return window.pdfjsLib
}

// ── Smart electricity extraction ─────────────────────────────────
// Strategy: find a line that contains a consumption keyword, then
// extract the FIRST reasonable number on that same line.
// This avoids grabbing bill numbers, meter codes, or account IDs.
function extractElectricity(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Keywords that appear on the consumption line in Indian utility bills
  const CONSUMPTION_KEYWORDS = [
    'consumption(units)',
    'consumption (units)',
    'units consumed',
    'total units',
    'net consumption',
    'billed units',
    'energy consumed',
    'balake',           // Kannada transliteration
    'baLake',
    'BalakE',
    'ಬಳಕೆ',            // Kannada script (if OCR picks it up)
  ]

  for (const line of lines) {
    const lower = line.toLowerCase()
    const hasKeyword = CONSUMPTION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()))
    if (!hasKeyword) continue

    // Extract all numbers from this line
    const nums = line.match(/[\d]+/g)
    if (!nums) continue

    // Filter to reasonable consumption values: 1–99999 kWh
    // Exclude numbers that look like meter readings (4+ digits that are too large)
    // or dates (8 digits), or account numbers (10+ digits)
    const candidates = nums
      .map(n => parseInt(n, 10))
      .filter(n => n >= 1 && n <= 99999)

    if (candidates.length === 0) continue

    // On a line like "Consumption(Units)   53" or "53.0   5.8   307.40"
    // the consumption value is typically the first small number
    // Sort ascending and take smallest that's >= 1
    candidates.sort((a, b) => a - b)
    const value = candidates[0]

    if (value >= 1 && value <= 99999) {
      return { value, confidence: 0.88 }
    }
  }

  // Fallback: scan for kWh pattern in full text
  const kwhMatch = text.match(/(\d{1,6})\s*k\.?w\.?h/i)
  if (kwhMatch) {
    const v = parseInt(kwhMatch[1], 10)
    if (v >= 1 && v <= 99999) return { value: v, confidence: 0.65 }
  }

  return null
}

// ── Fuel extraction — anchored to label lines ─────────────────────
function extractFuel(text, keywords, minVal, maxVal) {
  const lines = text.split('\n')
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (!keywords.some(kw => lower.includes(kw))) continue
    const nums = line.match(/[\d]+\.?[\d]*/g)
    if (!nums) continue
    const candidates = nums.map(Number).filter(n => n >= minVal && n <= maxVal)
    if (candidates.length) return { value: candidates[0], confidence: 0.75 }
  }
  return null
}

// ── Clean OCR text ────────────────────────────────────────────────
function cleanText(raw) {
  return raw
    .replace(/[|\\[\]{}@#$%^&*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── PDF first page to image ───────────────────────────────────────
async function pdfToImage(file) {
  const pdfjs = await loadPdfJs()
  const buf   = await file.arrayBuffer()
  const pdf   = await pdfjs.getDocument({ data: buf }).promise
  const page  = await pdf.getPage(1)
  const vp    = page.getViewport({ scale: 2.5 })  // higher scale = better accuracy
  const canvas = document.createElement('canvas')
  canvas.width  = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return canvas.toDataURL('image/png')
}

// ── Main export ───────────────────────────────────────────────────
export async function processElectricityBill(file, onProgress) {
  try {
    onProgress?.({ pct: 8,  message: 'Loading OCR engine' })
    const Tesseract = await loadTesseract()

    let src
    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf')
    if (isPDF) {
      onProgress?.({ pct: 18, message: 'Rendering PDF page' })
      src = await pdfToImage(file)
    } else {
      src = URL.createObjectURL(file)
    }

    onProgress?.({ pct: 28, message: 'Initialising OCR (English + Kannada)' })

    // Try eng+kan first for BESCOM bills, fallback to eng only
    let worker
    try {
      worker = await Tesseract.createWorker('eng+kan', 1, { logger: () => {} })
    } catch {
      onProgress?.({ pct: 38, message: 'Using English OCR' })
      worker = await Tesseract.createWorker('eng', 1, { logger: () => {} })
    }

    onProgress?.({ pct: 55, message: 'Reading bill' })
    const { data } = await worker.recognize(src)
    await worker.terminate()
    if (!isPDF) URL.revokeObjectURL(src)

    onProgress?.({ pct: 82, message: 'Extracting values' })

    const rawText = data.text
    const clean   = cleanText(rawText)

    const extractions = {}

    // Electricity — line-anchored extraction
    const elec = extractElectricity(rawText)
    if (elec) extractions.electricity_kwh = elec

    // Fuels — anchored to label lines
    const diesel = extractFuel(rawText, ['diesel','hsd'], 10, 50000)
    if (diesel) extractions.fuel_diesel = diesel

    const lpg = extractFuel(rawText, ['lpg','liquid petroleum'], 1, 10000)
    if (lpg) extractions.fuel_lpg = lpg

    const coal = extractFuel(rawText, ['coal'], 10, 100000)
    if (coal) extractions.fuel_coal = coal

    onProgress?.({ pct: 100, message: 'Done' })

    return {
      success: true,
      extractions,
      rawText,
      ocrConfidence: parseFloat((data.confidence || 0).toFixed(1)),
      fieldsFound: Object.keys(extractions).length,
    }
  } catch (err) {
    return { success: false, error: err.message, extractions: {}, fieldsFound: 0 }
  }
}
