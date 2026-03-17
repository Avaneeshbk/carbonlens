import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useEntries } from '../../hooks/useEntries'
import { calculateEmissions } from '../../lib/calculations'
import { FUEL_EF, MATERIAL_EF, LOGISTICS_EF, INDIA_STATES, GRID_EF } from '../../lib/emissionFactors'
import { detectAnomalies } from '../../lib/mlScoring'
import { processElectricityBill } from '../../lib/ocrProcessor'
import { PageHeader } from '../ui'
import { format, parseISO } from 'date-fns'

const TABS = [
  { id:'electricity', label:'Electricity' },
  { id:'fuels',       label:'Fuels'       },
  { id:'materials',   label:'Materials'   },
  { id:'logistics',   label:'Logistics'   },
]

function emptyDraft() {
  const d = new Date(); d.setDate(1)
  return {
    report_month: format(d,'yyyy-MM-dd'),
    electricity_kwh:'', solar_kwh:'', rec_kwh:'',
    fuel_diesel:'', fuel_lpg:'', fuel_coal:'',
    fuel_petrol:'', fuel_cng:'', fuel_furnaceOil:'',
    mat_steel:'', mat_cement:'', mat_aluminum:'', mat_copper:'',
    mat_plastic:'', mat_paper:'', mat_glass:'', mat_rubber:'',
    revenue_cr:'',
  }
}

const S = {
  ink:'#0E0E0E', ink2:'#3A3A3A', ink3:'#6B6B6B', ink4:'#9A9A9A',
  surface:'#F7F6F3', surface2:'#EFEDE8', surface3:'#E6E3DB',
  white:'#FDFCFA', border:'#E0DDD6',
  green:'#2D5016', greenL:'#EEF3E8', greenRule:'#C8D9B8',
  amber:'#92400E', amberL:'#FEF3E2', amberRule:'#FCD38D',
  red:'#7F1D1D', redL:'#FEF2F2', redRule:'#FECACA',
  s1:'#92400E', s2:'#1E3A5F', s3:'#3B1F6B',
}
const mono = { fontFamily:"'JetBrains Mono',monospace" }

export default function DataEntry() {
  const { company }           = useAuth()
  const { saveEntry, entries } = useEntries()
  const navigate              = useNavigate()
  const fileInputRef          = useRef(null)

  const [tab, setTab]               = useState('electricity')
  const [form, setForm]             = useState(emptyDraft)
  const [entryState, setEntryState] = useState(company?.state || 'Karnataka')
  const [logistics, setLogistics]   = useState([{ mode:'road', tonnes:'', distance_km:'' }])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  const [ocrState, setOcrState]         = useState('idle')
  const [ocrProgress, setOcrProgress]   = useState({ pct:0, message:'' })
  const [ocrResult, setOcrResult]       = useState(null)
  const [anomalies, setAnomalies]       = useState([])
  const [anomalyDismissed, setAnomalyDismissed] = useState(false)

  const gef = GRID_EF[entryState] || 0.82
  const setField = (k,v) => setForm(p=>({...p,[k]:v}))

  const preview = useMemo(
    () => calculateEmissions(form, entryState, logistics),
    [form, entryState, logistics]
  )

  // Check if this month already has data
  const existingEntry = useMemo(() => {
    if (!form.report_month || !entries.length) return null
    return entries.find(e => e.report_month.slice(0,7) === form.report_month.slice(0,7)) || null
  }, [form.report_month, entries])

  const hasData = form.electricity_kwh ||
    Object.keys(FUEL_EF).some(k => form[`fuel_${k}`] || form['fuel_furnaceOil'])

  // Anomaly detection
  useMemo(() => {
    if (!entries.length) return
    setAnomalies(detectAnomalies(form, entries))
    setAnomalyDismissed(false)
  }, [form.electricity_kwh, form.fuel_diesel, form.fuel_coal])

  async function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setOcrState('loading'); setOcrResult(null)
    const result = await processElectricityBill(file, prog => setOcrProgress(prog))
    if (result.success && result.fieldsFound > 0) {
      setOcrState('done'); setOcrResult(result)
      Object.entries(result.extractions).forEach(([key, ext]) => setField(key, ext.value.toString()))
    } else { setOcrState('error'); setOcrResult(result) }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function doSave() {
    setSaving(true); setError(''); setConfirmOverwrite(false)
    try {
      await saveEntry({ ...form }, logistics)
      setSuccess(true)
      setTimeout(() => navigate('/dashboard'), 900)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  function handleSave() {
    if (!hasData) { setError('Enter at least electricity or fuel data.'); return }
    // Warn if month already exists
    if (existingEntry && !confirmOverwrite) {
      setConfirmOverwrite(true)
      return
    }
    doSave()
  }

  const labelSt = { display:'block', fontSize:11, fontWeight:500,
    letterSpacing:'.06em', textTransform:'uppercase', color:S.ink3, marginBottom:6 }
  const inputSt = { width:'100%', padding:'9px 12px', border:`1px solid ${S.border}`,
    borderRadius:3, fontSize:13, outline:'none', background:S.white,
    fontFamily:'Inter,sans-serif', boxSizing:'border-box' }
  const hintSt = { fontSize:10.5, color:S.ink4, marginTop:4 }

  return (
    <div>
      <PageHeader title="Data Entry"
        subtitle="Monthly operational data · GHG Protocol Scope 1, 2 & 3" />

      {/* Existing month warning */}
      {existingEntry && !confirmOverwrite && (
        <div style={{ background:S.amberL, border:`1px solid ${S.amberRule}`,
          borderRadius:3, padding:'10px 14px', marginBottom:'1rem',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:12.5, color:S.amber }}>
            Data for <strong>{format(parseISO(existingEntry.report_month),'MMMM yyyy')}</strong> already
            exists ({existingEntry.total_tco2e?.toFixed(2)} tCO₂e). Saving will overwrite it.
          </div>
          <div style={{ display:'flex', gap:8, flexShrink:0, marginLeft:12 }}>
            <button onClick={() => setConfirmOverwrite(true)}
              style={{ fontSize:12, fontWeight:500, color:S.amber, background:'none',
                border:`1px solid ${S.amberRule}`, padding:'5px 12px',
                borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>
              Overwrite
            </button>
            <button onClick={() => setForm(p=>({...p, report_month:''}))}
              style={{ fontSize:12, color:S.ink3, background:'none', border:'none',
                cursor:'pointer', fontFamily:'inherit' }}>
              Change month
            </button>
          </div>
        </div>
      )}

      {/* Anomaly warnings */}
      {anomalies.length > 0 && !anomalyDismissed && (
        <div style={{ background:S.amberL, border:`1px solid ${S.amberRule}`,
          borderRadius:3, padding:'10px 14px', marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.07em',
                textTransform:'uppercase', color:S.amber, marginBottom:6 }}>
                Anomaly Detection — {anomalies.length} flag{anomalies.length>1?'s':''}
              </div>
              {anomalies.map(a => (
                <div key={a.field} style={{ fontSize:12, color:S.amber, marginBottom:4,
                  display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ ...mono, fontSize:10, background:'#FEE2B3',
                    padding:'1px 6px', borderRadius:2 }}>z={a.zScore}</span>
                  <span>
                    <strong>{a.label}</strong> is {a.pctChange>0?'+':''}{a.pctChange}% {a.direction} your
                    average ({a.mean.toLocaleString()} avg vs {a.current.toLocaleString()} entered)
                    {a.severity==='high' ? ' — verify before saving' : ''}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={()=>setAnomalyDismissed(true)}
              style={{ fontSize:10, color:S.amber, background:'none', border:'none',
                cursor:'pointer', padding:'0 0 0 12px', flexShrink:0 }}>Dismiss</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'1.25rem', alignItems:'start' }}>

        {/* ── Form ── */}
        <div>
          <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, marginBottom:'1rem' }}>
            {/* Context row */}
            <div style={{ padding:'1.25rem 1.5rem 0' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
                <div>
                  <label style={labelSt}>Month</label>
                  <input style={inputSt} type="month"
                    value={form.report_month.slice(0,7)}
                    onChange={e=>setField('report_month', e.target.value+'-01')} />
                </div>
                <div>
                  <label style={labelSt}>State</label>
                  <select style={inputSt} value={entryState}
                    onChange={e=>setEntryState(e.target.value)}>
                    {INDIA_STATES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Revenue (₹ Cr)</label>
                  <input style={inputSt} type="number" placeholder="12.5"
                    value={form.revenue_cr} onChange={e=>setField('revenue_cr',e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Grid EF (auto)</label>
                  <input style={{...inputSt, background:S.surface, color:S.ink3}}
                    value={`${gef} kg CO₂/kWh`} disabled readOnly />
                </div>
              </div>
              <div style={{ height:1, background:S.border }} />
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', gap:'1.5rem', padding:'0 1.5rem',
              borderBottom:`1px solid ${S.border}` }}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{ padding:'10px 0', border:'none', background:'transparent',
                    fontSize:13, cursor:'pointer', fontFamily:'inherit',
                    color: tab===t.id ? S.ink : S.ink3,
                    fontWeight: tab===t.id ? 500 : 400,
                    borderBottom:`1.5px solid ${tab===t.id ? S.ink : 'transparent'}`,
                    marginBottom:-1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding:'1.25rem 1.5rem 1.5rem' }}>
              {tab==='electricity' && (
                <div>
                  <p style={{ fontSize:12, color:S.ink3, marginBottom:14, lineHeight:1.6 }}>
                    Grid EF for <strong style={{color:S.ink2}}>{entryState}</strong>:{' '}
                    <span style={{...mono, fontSize:12}}>{gef} kg CO₂/kWh</span> (CEA 2024).
                    Updating the State field above changes this automatically.
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                    {[
                      ['electricity_kwh','Grid Electricity Consumed (kWh)','18500','Total units from monthly DISCOM bill'],
                      ['solar_kwh','On-site Solar Generation (kWh)','0','Offsets grid consumption — reduces Scope 2'],
                      ['rec_kwh','REC Offset (kWh)','0','Verified renewable certificates'],
                      ['revenue_cr','Revenue (₹ Crore)','9.8','Used for carbon intensity benchmarking'],
                    ].map(([k,l,ph,hint])=>(
                      <div key={k}>
                        <label style={labelSt}>{l}</label>
                        <input style={inputSt} type="number" placeholder={ph}
                          value={form[k]} onChange={e=>setField(k,e.target.value)} />
                        <div style={hintSt}>{hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab==='fuels' && (
                <div>
                  <p style={{ fontSize:12, color:S.ink3, marginBottom:14, lineHeight:1.6 }}>
                    All fuel combustion is Scope 1. Include diesel for generators, vehicles, and process equipment.
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                    {Object.entries(FUEL_EF).map(([key,f])=>{
                      const fk=key==='furnaceOil'?'fuel_furnaceOil':`fuel_${key}`
                      return (
                        <div key={key}>
                          <label style={labelSt}>{f.label}</label>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <input style={{...inputSt, flex:1}} type="number" placeholder="0"
                              value={form[fk]} onChange={e=>setField(fk,e.target.value)} />
                            <span style={{ fontSize:11, color:S.ink4, minWidth:40 }}>{f.unit}</span>
                          </div>
                          <div style={{...hintSt, ...mono}}>{f.ef} kg CO₂/{f.unit}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {tab==='materials' && (
                <div>
                  <p style={{ fontSize:12, color:S.ink3, marginBottom:14, lineHeight:1.6 }}>
                    Raw material embodied carbon is Scope 3 Category 1. Enter monthly procurement quantities in tonnes.
                  </p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                    {Object.entries(MATERIAL_EF).map(([key,m])=>(
                      <div key={key}>
                        <label style={labelSt}>{m.label}</label>
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <input style={{...inputSt, flex:1}} type="number" placeholder="0"
                            value={form[`mat_${key}`]} onChange={e=>setField(`mat_${key}`,e.target.value)} />
                          <span style={{ fontSize:11, color:S.ink4, minWidth:44 }}>tonnes</span>
                        </div>
                        <div style={{...hintSt, ...mono}}>{m.ef.toLocaleString()} kg CO₂e/t</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab==='logistics' && (
                <div>
                  <p style={{ fontSize:12, color:S.ink3, marginBottom:14, lineHeight:1.6 }}>
                    Freight is Scope 3 Cat. 4 & 9. Include inbound and outbound shipments.
                  </p>
                  {logistics.map((row,i)=>(
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr auto',
                      gap:'0.75rem', marginBottom:'0.75rem', paddingBottom:'0.75rem',
                      borderBottom:`1px solid ${S.surface3}` }}>
                      <div>
                        {i===0 && <label style={labelSt}>Mode</label>}
                        <select style={inputSt} value={row.mode}
                          onChange={e=>{ const l=[...logistics]; l[i].mode=e.target.value; setLogistics(l) }}>
                          {Object.entries(LOGISTICS_EF).map(([k,v])=>
                            <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div>
                        {i===0 && <label style={labelSt}>Tonnes</label>}
                        <input style={inputSt} type="number" placeholder="45"
                          value={row.tonnes}
                          onChange={e=>{ const l=[...logistics]; l[i].tonnes=e.target.value; setLogistics(l) }} />
                      </div>
                      <div>
                        {i===0 && <label style={labelSt}>Distance (km)</label>}
                        <input style={inputSt} type="number" placeholder="320"
                          value={row.distance_km}
                          onChange={e=>{ const l=[...logistics]; l[i].distance_km=e.target.value; setLogistics(l) }} />
                      </div>
                      <button onClick={()=>logistics.length>1&&setLogistics(logistics.filter((_,j)=>j!==i))}
                        style={{ padding:'8px 10px', border:`1px solid ${S.redRule}`, borderRadius:3,
                          background:S.redL, color:S.red, fontSize:13, cursor:'pointer',
                          marginTop:i===0?20:0 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>setLogistics([...logistics,{mode:'road',tonnes:'',distance_km:''}])}
                    style={{ fontSize:12, color:S.ink2, background:'transparent',
                      border:`1px solid ${S.border}`, padding:'7px 14px',
                      borderRadius:3, cursor:'pointer', fontFamily:'inherit' }}>
                    + Add route
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ fontSize:12.5, color:S.red, background:S.redL,
              border:`1px solid ${S.redRule}`, padding:'10px 14px',
              borderRadius:3, marginBottom:12 }}>{error}</div>
          )}
          {success && (
            <div style={{ fontSize:12.5, color:S.green, background:S.greenL,
              border:`1px solid ${S.greenRule}`, padding:'10px 14px',
              borderRadius:3, marginBottom:12 }}>Saved. Redirecting…</div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background:saving?'#555':S.ink, color:S.white,
                border:`1px solid ${saving?'#555':S.ink}`, padding:'9px 20px',
                borderRadius:3, fontSize:13, fontWeight:500,
                cursor:saving?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {saving ? 'Saving…' : confirmOverwrite ? 'Confirm Overwrite' : 'Save & Calculate'}
            </button>
            {confirmOverwrite && (
              <button onClick={()=>setConfirmOverwrite(false)}
                style={{ background:'transparent', color:S.ink3, border:`1px solid ${S.border}`,
                  padding:'9px 16px', borderRadius:3, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            )}
            <button onClick={()=>navigate('/dashboard')}
              style={{ background:'transparent', color:S.ink3, border:'none',
                padding:'9px 14px', borderRadius:3, fontSize:13,
                cursor:'pointer', fontFamily:'inherit' }}>
              Back
            </button>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ position:'sticky', top:'1rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Live calc */}
          <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.25rem' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.1em',
              textTransform:'uppercase', color:S.ink4, marginBottom:12 }}>Live Calculation</div>
            {!hasData ? (
              <div style={{ fontSize:12.5, color:S.ink4, textAlign:'center',
                padding:'1.5rem 0', lineHeight:1.7 }}>
                Enter data to see<br />live calculation
              </div>
            ) : (
              <>
                <div style={{ textAlign:'center', padding:'1rem', borderRadius:3,
                  marginBottom:12, background:S.greenL, border:`1px solid ${S.greenRule}` }}>
                  <div style={{ fontSize:9, color:S.green, fontWeight:600,
                    letterSpacing:'.08em', textTransform:'uppercase', marginBottom:5 }}>This Month</div>
                  <div style={{ fontSize:30, fontWeight:500, color:S.green,
                    fontFamily:"'Playfair Display',serif", lineHeight:1 }}>
                    {preview.total.toFixed(2)}
                  </div>
                  <div style={{ fontSize:11, color:S.green, marginTop:3 }}>tCO₂e</div>
                </div>
                {[['Scope 1',preview.scope1,S.s1],['Scope 2',preview.scope2,S.s2],['Scope 3',preview.scope3,S.s3]]
                  .map(([l,v,c],i,arr)=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', padding:'7px 0',
                    borderBottom:i<arr.length-1?`1px solid ${S.surface3}`:'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:6, height:6, borderRadius:1, background:c, flexShrink:0 }} />
                      <span style={{ fontSize:11.5, color:S.ink3 }}>{l}</span>
                    </div>
                    <span style={{ fontSize:12.5, fontWeight:600, color:S.ink, ...mono }}>
                      {v.toFixed(3)} t
                    </span>
                  </div>
                ))}
                <div style={{ marginTop:10, padding:'8px 10px', borderRadius:3, background:S.surface }}>
                  <div style={{ fontSize:10, color:S.ink4, lineHeight:1.6 }}>
                    GHG Protocol · {entryState} CEA 2024 · {gef} kg/kWh · IPCC AR6
                  </div>
                </div>
              </>
            )}
          </div>

          {/* OCR */}
          <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.25rem' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.1em',
              textTransform:'uppercase', color:S.ink4, marginBottom:10 }}>Bill OCR</div>

            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
              style={{ display:'none' }} onChange={handleFileUpload} />

            <button onClick={()=>fileInputRef.current?.click()}
              disabled={ocrState==='loading'}
              style={{ width:'100%', padding:'10px 12px',
                border:`1.5px dashed ${S.border}`, borderRadius:3,
                background:S.surface, cursor:ocrState==='loading'?'not-allowed':'pointer',
                fontSize:12.5, color:S.ink2, fontFamily:'inherit',
                textAlign:'center', transition:'all .15s' }}>
              {ocrState==='idle' ? 'Upload electricity bill'
                : ocrState==='loading' ? `${ocrProgress.message} (${ocrProgress.pct}%)`
                : ocrState==='done' ? 'Upload another bill'
                : 'Retry upload'}
            </button>
            <div style={{ fontSize:10, color:S.ink4, marginTop:6 }}>
              PDF, JPG, PNG · Tesseract.js · runs in browser, no data sent externally
            </div>

            {ocrState==='loading' && (
              <div style={{ marginTop:8, height:2, background:S.border, borderRadius:1, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${ocrProgress.pct}%`,
                  background:S.ink2, borderRadius:1, transition:'width .3s' }} />
              </div>
            )}

            {ocrState==='done' && ocrResult && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.06em',
                  textTransform:'uppercase', color:S.green, marginBottom:8 }}>
                  {ocrResult.fieldsFound} field{ocrResult.fieldsFound>1?'s':''} extracted
                  · OCR confidence {ocrResult.ocrConfidence}%
                </div>
                {Object.entries(ocrResult.extractions).map(([key,ext])=>(
                  <div key={key} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:11.5, marginBottom:5, paddingBottom:5,
                    borderBottom:`1px solid ${S.surface3}` }}>
                    <span style={{ color:S.ink3 }}>{key.replace(/_/g,' ')}</span>
                    <span style={{ ...mono, color:S.ink, fontWeight:500 }}>
                      {ext.value.toLocaleString()}
                      <span style={{ fontSize:9, color:S.ink4, marginLeft:4 }}>
                        {(ext.confidence*100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                ))}
                <div style={{ fontSize:10, color:S.ink4, marginTop:4, lineHeight:1.5 }}>
                  Verify all values against your physical bill before saving.
                </div>
              </div>
            )}

            {ocrState==='error' && ocrResult && (
              <div style={{ marginTop:8, fontSize:11.5, color:S.red, lineHeight:1.5 }}>
                {ocrResult.error || 'Could not extract data. Enter values manually.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
