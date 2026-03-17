import { useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEntries } from '../../hooks/useEntries'
import { sumEmissions } from '../../lib/calculations'
import { GRID_EF } from '../../lib/emissionFactors'
import { Spinner, EmptyState } from '../ui'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'

const S = {
  ink:'#0E0E0E', ink2:'#3A3A3A', ink3:'#6B6B6B', ink4:'#9A9A9A',
  surface:'#F7F6F3', surface2:'#EFEDE8', surface3:'#E6E3DB',
  white:'#FDFCFA', border:'#E0DDD6', border2:'#CBC8C0',
  green:'#2D5016', greenL:'#EEF3E8', greenRule:'#C8D9B8',
  s1:'#92400E', s2:'#1E3A5F', s3:'#3B1F6B',
}
const mono = { fontFamily:"'JetBrains Mono',monospace" }

function Row({ label, value, bold, indent, mono: useMono }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline',
      padding:'7px 0', borderBottom:`1px solid ${S.surface3}` }}>
      <span style={{ fontSize:13, color: bold ? S.ink : S.ink3, fontWeight: bold?600:400,
        paddingLeft: indent?'1rem':0 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight: bold?700:600, color:S.ink,
        ...(useMono ? mono : {}) }}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:'2rem' }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:'.14em',
        textTransform:'uppercase', color:S.ink4, marginBottom:'0.875rem',
        paddingBottom:'0.625rem', borderBottom:`1px solid ${S.border}` }}>{title}</div>
      {children}
    </div>
  )
}

function ScopePill({ s }) {
  const c = { 1:{bg:'#FFF7ED',color:S.s1,l:'Scope 1'}, 2:{bg:'#EAF0F8',color:S.s2,l:'Scope 2'}, 3:{bg:'#F0EAFE',color:S.s3,l:'Scope 3'} }[s]
  return (
    <span style={{ fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:2,
      background:c.bg, color:c.color, letterSpacing:'.05em', textTransform:'uppercase' }}>{c.l}</span>
  )
}

function downloadText(content, filename) {
  const blob = new Blob([content], { type:'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

function generateBRSR(company, totals, entries, calcs, startMonth, endMonth) {
  const fmtS = d => format(parseISO(d),'MMM yyyy')
  const gef  = GRID_EF[company?.state] || 0.82
  const rev  = entries.reduce((s,e)=>s+(parseFloat(e.revenue_cr)||0),0)
  const intensity = rev>0 ? (totals.total/rev).toFixed(2) : 'N/A'
  return `BUSINESS RESPONSIBILITY AND SUSTAINABILITY REPORT (BRSR)
SECTION C — PRINCIPLE 6: ENVIRONMENT
${'─'.repeat(56)}

COMPANY DETAILS
Legal Name           : ${company?.name}
GSTIN                : ${company?.gstin || 'Not provided'}
Address              : ${company?.address || 'Not provided'}
Industry             : ${company?.industry}
State                : ${company?.state}
Reporting Period     : ${fmtS(startMonth)} to ${fmtS(endMonth)}

ESSENTIAL INDICATOR 1 — ENERGY CONSUMPTION
Grid electricity consumed : ${entries.reduce((s,e)=>s+(parseFloat(e.electricity_kwh)||0),0).toLocaleString()} kWh
Grid emission factor      : ${gef} kg CO₂/kWh (CEA Annual Report 2024, ${company?.state})

ESSENTIAL INDICATOR 2 — GHG EMISSIONS
Scope 1  : ${totals.scope1.toFixed(2)} tCO₂e
Scope 2  : ${totals.scope2.toFixed(2)} tCO₂e
Scope 3  : ${totals.scope3.toFixed(2)} tCO₂e
Total    : ${totals.total.toFixed(2)} tCO₂e
Intensity: ${intensity} tCO₂e / ₹ Crore

METHODOLOGY
Standard   : GHG Protocol Corporate Accounting & Reporting Standard (Revised)
Scope 1 EF : IPCC AR6 Table A.II.4
Scope 2 EF : CEA Annual Report 2024
Scope 3 EF : Ecoinvent 3.9 / GLEC Framework v2
GWP        : IPCC AR6 100-year values

MONTHLY BREAKDOWN
${'Month'.padEnd(12)} ${'Scope 1'.padEnd(10)} ${'Scope 2'.padEnd(10)} ${'Scope 3'.padEnd(10)} Total
${entries.map((e,i)=>{
  const c=calcs[i]; if(!c) return ''
  return `${format(parseISO(e.report_month),'MMM yyyy').padEnd(12)} ${c.scope1.toFixed(2).padEnd(10)} ${c.scope2.toFixed(2).padEnd(10)} ${c.scope3.toFixed(2).padEnd(10)} ${c.total.toFixed(2)}`
}).join('\n')}

Authorised Signatory : ___________________________
Designation          : ___________________________
Date                 : ___________________________`
}

function generateBuyerDeclaration(company, totals, startMonth, endMonth) {
  const fmtL = d => format(parseISO(d),'MMMM yyyy')
  return `SUPPLIER CARBON FOOTPRINT DECLARATION
${'─'.repeat(56)}

Company          : ${company?.name}
GSTIN            : ${company?.gstin || 'N/A'}
Address          : ${company?.address || 'N/A'}
Industry         : ${company?.industry}
Reporting Period : ${fmtL(startMonth)} to ${fmtL(endMonth)}

GHG EMISSIONS SUMMARY
Scope 1 — Direct Emissions      : ${totals.scope1.toFixed(2)} tCO₂e
Scope 2 — Grid Electricity      : ${totals.scope2.toFixed(2)} tCO₂e
Scope 3 — Value Chain (selected): ${totals.scope3.toFixed(2)} tCO₂e
Total GHG Emissions             : ${totals.total.toFixed(2)} tCO₂e

Prepared per GHG Protocol Corporate Standard.
Emission factors: CEA 2024 (Scope 2), IPCC AR6 (Scope 1), Ecoinvent 3.9 (Scope 3).

Name        : ___________________________
Designation : ___________________________
Signature   : ___________________________
Date        : ___________________________`
}

const TABS = [
  { id:'ghg',   label:'GHG Protocol' },
  { id:'brsr',  label:'SEBI BRSR'    },
  { id:'buyer', label:'Buyer Declaration' },
]

export default function Report() {
  const { company }               = useAuth()
  const { entries, calcs, loading } = useEntries()
  const navigate                  = useNavigate()
  const [tab, setTab]             = useState('ghg')

  const totals       = useMemo(() => sumEmissions(calcs), [calcs])
  const totalRevenue = useMemo(() => entries.reduce((s,e)=>s+(parseFloat(e.revenue_cr)||0),0), [entries])
  const gef          = GRID_EF[company?.state] || 0.82
  const startMonth   = entries[0]?.report_month
  const endMonth     = entries[entries.length-1]?.report_month
  const avgIntensity = totalRevenue>0 ? (totals.total/totalRevenue).toFixed(2) : '—'
  const fmtS         = d => format(parseISO(d),'MMM yyyy')
  const fmtL         = d => format(parseISO(d),'MMMM yyyy')

  if (loading) return <Spinner message="Generating report…" />
  if (!entries.length) return (
    <div>
      <div style={{ marginBottom:'1.75rem' }}>
        <div style={{ fontSize:26, fontFamily:"'Playfair Display',serif",
          fontWeight:500, color:S.ink, marginBottom:4 }}>Report</div>
        <div style={{ fontSize:13, color:S.ink3 }}>GHG Protocol · SEBI BRSR · EU CBAM</div>
      </div>
      <EmptyState icon="—" title="No data yet"
        desc="Enter at least one month of data to generate your compliance report."
        action={<button className="btn-primary" onClick={()=>navigate('/data-entry')}>Enter first month</button>} />
    </div>
  )

  const scope1Lines = [
    ['Diesel combustion',   entries.reduce((s,e)=>s+(parseFloat(e.fuel_diesel)||0)*2.68/1000,0)],
    ['LPG combustion',      entries.reduce((s,e)=>s+(parseFloat(e.fuel_lpg)||0)*1.51/1000,0)],
    ['Coal combustion',     entries.reduce((s,e)=>s+(parseFloat(e.fuel_coal)||0)*2.42/1000,0)],
    ['Other fuels',         entries.reduce((s,e)=>s+((parseFloat(e.fuel_petrol)||0)*2.31+(parseFloat(e.fuel_cng)||0)*2.21+(parseFloat(e.fuel_furnace_oil)||0)*3.15)/1000,0)],
  ].filter(([,v])=>v>0.001)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:'1.75rem' }}>
        <div>
          <div style={{ fontSize:26, fontFamily:"'Playfair Display',serif",
            fontWeight:500, color:S.ink, marginBottom:4 }}>Compliance Report</div>
          <div style={{ fontSize:13, color:S.ink3 }}>
            {fmtS(startMonth)} – {fmtS(endMonth)} · {entries.length} months · GHG Protocol · SEBI BRSR
          </div>
        </div>
        <button onClick={()=>window.print()} className="btn-primary no-print"
          style={{ fontSize:13 }}>Print / Save PDF</button>
      </div>

      {/* Tabs — clean underline style, no background */}
      <div style={{ display:'flex', gap:'2rem', borderBottom:`1px solid ${S.border}`,
        marginBottom:'1.5rem' }} className="no-print">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ padding:'0 0 10px', border:'none', background:'transparent',
              fontSize:13, cursor:'pointer', fontFamily:'inherit',
              color: tab===t.id ? S.ink : S.ink3,
              fontWeight: tab===t.id ? 500 : 400,
              borderBottom:`1.5px solid ${tab===t.id ? S.ink : 'transparent'}`,
              marginBottom:-1, transition:'all .12s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:'1.25rem', alignItems:'start' }}>

        {/* ── GHG Protocol ── */}
        {tab==='ghg' && (
          <div style={{ background:S.white, border:`1px solid ${S.border}`,
            borderRadius:4, borderTop:`2px solid ${S.ink}`, padding:'2rem' }}>

            {/* Masthead */}
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', marginBottom:'2rem' }}>
              <div>
                <div style={{ fontSize:9, color:S.ink4, letterSpacing:'.14em',
                  textTransform:'uppercase', marginBottom:8 }}>Greenhouse Gas Inventory Report</div>
                <div style={{ fontSize:20, fontWeight:500, color:S.ink,
                  fontFamily:"'Playfair Display',serif", marginBottom:4 }}>{company?.name}</div>
                <div style={{ fontSize:12.5, color:S.ink3 }}>{company?.address}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:S.ink4, letterSpacing:'.06em',
                  textTransform:'uppercase', marginBottom:6 }}>Reporting Period</div>
                <div style={{ fontSize:13, fontWeight:600, color:S.ink }}>
                  {fmtS(startMonth)} – {fmtS(endMonth)}
                </div>
                <div style={{ fontSize:10, color:S.ink4, marginTop:4 }}>GHG Protocol · CEA 2024</div>
              </div>
            </div>

            {/* Totals strip — all ink, no colour coding */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
              gap:'0.75rem', marginBottom:'2rem' }}>
              {[
                ['Total Emissions', `${totals.total.toFixed(2)}`, 'tCO₂e'],
                ['Scope 1',         `${totals.scope1.toFixed(2)}`, 'tCO₂e'],
                ['Scope 2',         `${totals.scope2.toFixed(2)}`, 'tCO₂e'],
                ['Intensity',       avgIntensity,                   't / ₹Cr'],
              ].map(([l,v,u])=>(
                <div key={l} style={{ background:S.surface, borderRadius:3,
                  padding:'0.875rem', border:`1px solid ${S.border}` }}>
                  <div style={{ fontSize:9, color:S.ink4, marginBottom:6,
                    textTransform:'uppercase', letterSpacing:'.07em' }}>{l}</div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                    <span style={{ fontSize:20, fontWeight:500, color:S.ink,
                      fontFamily:"'Playfair Display',serif", ...mono }}>{v}</span>
                    <span style={{ fontSize:10, color:S.ink4 }}>{u}</span>
                  </div>
                </div>
              ))}
            </div>

            <Section title="Organisation Profile">
              <Row label="Legal Name"             value={company?.name} bold />
              <Row label="GSTIN"                  value={company?.gstin||'—'} mono />
              <Row label="Registered Address"     value={company?.address||'—'} />
              <Row label="Primary Industry"       value={company?.industry} />
              <Row label="State / UT"             value={company?.state} />
              <Row label="Employees"              value={company?.employees?.toString()||'—'} />
              <Row label="Consolidation Approach" value="Operational Control" />
              <Row label="Reporting Standard"     value="GHG Protocol Corporate Standard (Revised)" />
            </Section>

            <Section title="Emission Inventory — Scope 1, 2 & 3">
              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 8px' }}>
                <ScopePill s={1} />
                <span style={{ fontSize:12, color:S.ink3 }}>Direct Emissions</span>
              </div>
              {scope1Lines.map(([l,v])=><Row key={l} label={l} value={`${v.toFixed(3)} tCO₂e`} indent />)}
              <Row label="Scope 1 Subtotal" value={`${totals.scope1.toFixed(3)} tCO₂e`} bold />

              <div style={{ height:1, background:S.surface3, margin:'12px 0' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 8px' }}>
                <ScopePill s={2} />
                <span style={{ fontSize:12, color:S.ink3 }}>Energy Indirect</span>
              </div>
              <Row label={`Grid electricity — ${company?.state} (location-based)`}
                value={`${totals.scope2.toFixed(3)} tCO₂e`} indent />
              <Row label="Scope 2 Subtotal" value={`${totals.scope2.toFixed(3)} tCO₂e`} bold />

              <div style={{ height:1, background:S.surface3, margin:'12px 0' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0 8px' }}>
                <ScopePill s={3} />
                <span style={{ fontSize:12, color:S.ink3 }}>Value Chain (selected categories)</span>
              </div>
              <Row label="Cat. 1 — Purchased goods & raw materials"
                value={`${calcs.reduce((s,c)=>s+(c.materials||0),0).toFixed(3)} tCO₂e`} indent />
              <Row label="Cat. 4 & 9 — Upstream & downstream transport"
                value={`${calcs.reduce((s,c)=>s+(c.logistics||0),0).toFixed(3)} tCO₂e`} indent />
              <Row label="Scope 3 Subtotal" value={`${totals.scope3.toFixed(3)} tCO₂e`} bold />

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                marginTop:'1rem', padding:'0.875rem 1rem',
                background:S.surface, borderRadius:3, border:`1px solid ${S.border}` }}>
                <span style={{ fontWeight:700, fontSize:14, color:S.ink }}>
                  Total GHG Emissions (Scope 1+2+3)
                </span>
                <span style={{ fontSize:20, fontWeight:500, color:S.ink,
                  fontFamily:"'Playfair Display',serif", ...mono }}>
                  {totals.total.toFixed(2)} tCO₂e
                </span>
              </div>
            </Section>

            <Section title="Monthly Breakdown">
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.surface }}>
                    {['Month','Scope 1','Scope 2','Scope 3','Total','t/₹Cr'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'7px 10px',
                        borderBottom:`1px solid ${S.border}`, fontSize:9, fontWeight:700,
                        textTransform:'uppercase', letterSpacing:'.07em', color:S.ink4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e,i)=>{
                    const c=calcs[i]; if(!c) return null
                    const r=parseFloat(e.revenue_cr)||0
                    return (
                      <tr key={e.id} style={{ borderBottom:`1px solid ${S.surface3}` }}>
                        <td style={{ padding:'7px 10px', fontWeight:500 }}>{fmtS(e.report_month)}</td>
                        <td style={{ padding:'7px 10px', ...mono }}>{c.scope1.toFixed(3)}</td>
                        <td style={{ padding:'7px 10px', ...mono }}>{c.scope2.toFixed(3)}</td>
                        <td style={{ padding:'7px 10px', ...mono }}>{c.scope3.toFixed(3)}</td>
                        <td style={{ padding:'7px 10px', ...mono, fontWeight:600 }}>{c.total.toFixed(3)}</td>
                        <td style={{ padding:'7px 10px', ...mono, color:S.ink3 }}>{r>0?(c.total/r).toFixed(2):'—'}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ background:S.surface, fontWeight:700 }}>
                    <td style={{ padding:'7px 10px' }}>Period total</td>
                    <td style={{ padding:'7px 10px', ...mono }}>{totals.scope1.toFixed(3)}</td>
                    <td style={{ padding:'7px 10px', ...mono }}>{totals.scope2.toFixed(3)}</td>
                    <td style={{ padding:'7px 10px', ...mono }}>{totals.scope3.toFixed(3)}</td>
                    <td style={{ padding:'7px 10px', ...mono, fontWeight:800 }}>{totals.total.toFixed(3)}</td>
                    <td style={{ padding:'7px 10px', ...mono, color:S.ink3 }}>{avgIntensity}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section title="Methodology & Emission Factors">
              <p style={{ fontSize:12.5, color:S.ink3, lineHeight:1.7, marginBottom:'1rem' }}>
                Prepared in accordance with the <strong style={{color:S.ink}}>GHG Protocol Corporate
                Accounting and Reporting Standard (Revised Edition)</strong>. All emission factors
                are sourced from internationally recognised databases and India-specific official sources.
              </p>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:S.surface }}>
                    {['Emission Source','Data Source','Factor'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'7px 10px',
                        borderBottom:`1px solid ${S.border}`, fontSize:9, fontWeight:700,
                        textTransform:'uppercase', letterSpacing:'.07em', color:S.ink4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Scope 1 — Fuel combustion',       'IPCC AR6 Table A.II.4',       'kg CO₂e / unit'],
                    [`Scope 2 — Grid (${company?.state})`, 'CEA Annual Report 2024',   `${gef} kg CO₂/kWh`],
                    ['Scope 3 — Raw materials',          'Ecoinvent 3.9',               'kg CO₂e / tonne'],
                    ['Scope 3 — Logistics',              'GLEC Framework v2 / MoRTH',   'kg CO₂e / tonne-km'],
                    ['GWP values',                       'IPCC AR6',                    '100-year basis'],
                  ].map(([a,b,c])=>(
                    <tr key={a} style={{ borderBottom:`1px solid ${S.surface3}` }}>
                      <td style={{ padding:'7px 10px', fontWeight:500, color:S.ink }}>{a}</td>
                      <td style={{ padding:'7px 10px', color:S.ink3 }}>{b}</td>
                      <td style={{ padding:'7px 10px', color:S.ink4, ...mono, fontSize:11 }}>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Declaration & Signatory">
              <p style={{ fontSize:12.5, color:S.ink3, lineHeight:1.7, marginBottom:'1.5rem' }}>
                I confirm that the GHG emissions data in this report has been prepared in good
                faith and accurately represents the operational emissions of{' '}
                <strong style={{color:S.ink}}>{company?.name}</strong> for the stated reporting
                period, in accordance with the GHG Protocol Corporate Standard.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3rem' }}>
                {['Authorised Signatory — Name & Designation','Date of Declaration'].map(l=>(
                  <div key={l}>
                    <div style={{ height:36, borderBottom:`1px solid ${S.ink}`, marginBottom:8 }} />
                    <div style={{ fontSize:11.5, fontWeight:500, color:S.ink }}>{l.split(' — ')[0]}</div>
                    {l.includes('—') && <div style={{ fontSize:11, color:S.ink4 }}>{l.split(' — ')[1]}</div>}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── BRSR ── */}
        {tab==='brsr' && (
          <div style={{ background:S.white, border:`1px solid ${S.border}`,
            borderRadius:4, borderTop:`2px solid ${S.ink}`, padding:'2rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', marginBottom:'1.5rem' }}>
              <div>
                <div style={{ fontSize:9, color:S.ink4, letterSpacing:'.14em',
                  textTransform:'uppercase', marginBottom:6 }}>
                  SEBI BRSR — Section C, Principle 6
                </div>
                <div style={{ fontSize:18, fontWeight:500, color:S.ink,
                  fontFamily:"'Playfair Display',serif" }}>
                  Business Responsibility & Sustainability Report
                </div>
              </div>
              <button onClick={()=>downloadText(
                generateBRSR(company,totals,entries,calcs,startMonth,endMonth),
                `BRSR_${company?.name?.replace(/\s+/g,'_')}_${fmtS(endMonth)}.txt`
              )} className="btn-primary no-print" style={{ fontSize:12.5, whiteSpace:'nowrap' }}>
                Download BRSR
              </button>
            </div>

            <p style={{ fontSize:12.5, color:S.ink3, lineHeight:1.7, marginBottom:'1.5rem' }}>
              BRSR is mandatory for top 1000 listed companies (SEBI circular, FY 2022–23).
              This report covers Section C, Principle 6 — Environment,
              Essential Indicators 1 & 2.
            </p>

            <Section title="Essential Indicator 1 — Energy Consumption">
              <Row label="Total grid electricity consumed"
                value={`${entries.reduce((s,e)=>s+(parseFloat(e.electricity_kwh)||0),0).toLocaleString()} kWh`} />
              <Row label="Grid emission factor applied"
                value={`${gef} kg CO₂/kWh (CEA 2024 — ${company?.state})`} />
              <Row label="On-site solar generation"
                value={`${entries.reduce((s,e)=>s+(parseFloat(e.solar_kwh)||0),0).toLocaleString()} kWh`} />
            </Section>

            <Section title="Essential Indicator 2 — GHG Emissions">
              <Row label="Scope 1 — Direct emissions"           value={`${totals.scope1.toFixed(2)} tCO₂e`} />
              <Row label="Scope 2 — Indirect (electricity)"     value={`${totals.scope2.toFixed(2)} tCO₂e`} />
              <Row label="Scope 3 — Value chain (selected)"     value={`${totals.scope3.toFixed(2)} tCO₂e`} />
              <Row label="Total GHG Emissions"                  value={`${totals.total.toFixed(2)} tCO₂e`} bold />
              <Row label="Carbon Intensity (tCO₂e / ₹ Crore)"  value={avgIntensity} bold />
            </Section>

            <Section title="Methodology">
              <Row label="Standard"              value="GHG Protocol Corporate Standard (Revised Edition)" />
              <Row label="GWP values"            value="IPCC AR6 — 100-year GWP" />
              <Row label="Scope 2 approach"      value="Location-based" />
              <Row label="Third-party verification" value="Pending — ISO 14064-1" />
            </Section>

            <div style={{ padding:'0.875rem 1rem', background:S.surface,
              borderRadius:3, border:`1px solid ${S.border}`,
              fontSize:12, color:S.ink3, marginTop:'1rem', lineHeight:1.6 }}>
              This report satisfies SEBI BRSR Principle 6 Essential Indicators 1 & 2
              for the period {fmtL(startMonth)} to {fmtL(endMonth)}.
            </div>
          </div>
        )}

        {/* ── Buyer Declaration ── */}
        {tab==='buyer' && (
          <div style={{ background:S.white, border:`1px solid ${S.border}`,
            borderRadius:4, borderTop:`2px solid ${S.ink}`, padding:'2rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'flex-start', marginBottom:'1.5rem' }}>
              <div>
                <div style={{ fontSize:9, color:S.ink4, letterSpacing:'.14em',
                  textTransform:'uppercase', marginBottom:6 }}>Supply Chain Disclosure</div>
                <div style={{ fontSize:18, fontWeight:500, color:S.ink,
                  fontFamily:"'Playfair Display',serif" }}>
                  Supplier Carbon Footprint Declaration
                </div>
              </div>
              <button onClick={()=>downloadText(
                generateBuyerDeclaration(company,totals,startMonth,endMonth),
                `CarbonDeclaration_${company?.name?.replace(/\s+/g,'_')}_${fmtS(endMonth)}.txt`
              )} className="btn-primary no-print" style={{ fontSize:12.5, whiteSpace:'nowrap' }}>
                Download Declaration
              </button>
            </div>

            <p style={{ fontSize:12.5, color:S.ink3, lineHeight:1.7, marginBottom:'1.5rem' }}>
              Submit this declaration to buyers (Tata, Mahindra, Walmart, H&M, IKEA),
              export councils, or banks requiring supplier carbon disclosure data.
            </p>

            <Section title="Supplier Details">
              <Row label="Company" value={company?.name} bold />
              <Row label="GSTIN"   value={company?.gstin||'—'} mono />
              <Row label="Address" value={company?.address||'—'} />
              <Row label="Sector"  value={company?.industry} />
            </Section>

            <Section title="Emissions Summary">
              <Row label="Reporting Period"          value={`${fmtS(startMonth)} – ${fmtS(endMonth)}`} />
              <Row label="Scope 1 — Direct"          value={`${totals.scope1.toFixed(2)} tCO₂e`} />
              <Row label="Scope 2 — Electricity"     value={`${totals.scope2.toFixed(2)} tCO₂e`} />
              <Row label="Scope 3 — Value Chain"     value={`${totals.scope3.toFixed(2)} tCO₂e`} />
              <Row label="Total GHG Emissions"       value={`${totals.total.toFixed(2)} tCO₂e`} bold />
              <Row label="Carbon Intensity"          value={`${avgIntensity} tCO₂e / ₹ Crore`} />
            </Section>

            <Section title="Methodology">
              <p style={{ fontSize:12.5, color:S.ink3, lineHeight:1.7 }}>
                Prepared per the GHG Protocol Corporate Standard using CEA 2024 grid factors,
                IPCC AR6 fuel emission factors, and Ecoinvent 3.9 material factors.
                This declaration may be submitted to buyers and regulators as evidence of
                carbon footprint disclosure.
              </p>
            </Section>

            <Section title="Signatory">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem', marginTop:'0.5rem' }}>
                {['Name & Designation','Signature & Stamp','Date','Company Seal'].map(l=>(
                  <div key={l}>
                    <div style={{ height:36, borderBottom:`1px solid ${S.border2}`, marginBottom:6 }} />
                    <div style={{ fontSize:11, color:S.ink4 }}>{l}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── Sidebar ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem',
          position:'sticky', top:'1rem' }} className="no-print">

          {/* Compliance checklist */}
          <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.25rem' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
              textTransform:'uppercase', color:S.ink4, marginBottom:12 }}>
              Compliance Status
            </div>
            {[
              ['GHG Protocol Scope 1', true],
              ['GHG Protocol Scope 2', true],
              ['GHG Protocol Scope 3', true],
              ['SEBI BRSR Core KPIs',  true],
              ['India CEA Grid EF',    true],
              ['EU CBAM Format',       false],
              ['ISO 14064 Verification',false],
            ].map(([l,done])=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'5px 0', borderBottom:`1px solid ${S.surface3}` }}>
                <div style={{ width:14, height:14, borderRadius:'50%', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:8,
                  background: done ? S.greenL : S.surface2,
                  border: `1px solid ${done ? S.greenRule : S.border}`,
                  color: done ? S.green : '' }}>
                  {done ? '✓' : ''}
                </div>
                <span style={{ fontSize:11.5, color: done?S.ink:S.ink4 }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Export options */}
          <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.25rem' }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
              textTransform:'uppercase', color:S.ink4, marginBottom:12 }}>Export</div>
            <button onClick={()=>window.print()}
              style={{ width:'100%', marginBottom:8, background:S.ink, color:S.white,
                border:`1px solid ${S.ink}`, padding:'8px 12px', borderRadius:3,
                fontSize:12.5, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
              Print / Save as PDF
            </button>
            <button onClick={()=>downloadText(
              generateBRSR(company,totals,entries,calcs,startMonth,endMonth),
              `BRSR_${company?.name?.replace(/\s+/g,'_')}.txt`
            )} style={{ width:'100%', marginBottom:8, background:'transparent', color:S.ink,
              border:`1px solid ${S.border}`, padding:'8px 12px', borderRadius:3,
              fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
              Download BRSR (.txt)
            </button>
            <button onClick={()=>downloadText(
              generateBuyerDeclaration(company,totals,startMonth,endMonth),
              `BuyerDeclaration_${company?.name?.replace(/\s+/g,'_')}.txt`
            )} style={{ width:'100%', background:'transparent', color:S.ink,
              border:`1px solid ${S.border}`, padding:'8px 12px', borderRadius:3,
              fontSize:12.5, cursor:'pointer', fontFamily:'inherit' }}>
              Download Buyer Declaration (.txt)
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
