import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, ArcElement, Tooltip, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { useAuth } from '../../hooks/useAuth'
import { useEntries } from '../../hooks/useEntries'
import { sumEmissions, calcMoMChange } from '../../lib/calculations'
import { GRID_EF, SECTOR_BENCHMARKS } from '../../lib/emissionFactors'
import { KpiCard, PageHeader, SourceBar, Spinner, EmptyState } from '../ui'
import { format, parseISO } from 'date-fns'

ChartJS.register(CategoryScale,LinearScale,PointElement,LineElement,ArcElement,Tooltip,Filler)

const S = { s1:'#92400E', s2:'#1E3A5F', s3:'#3B1F6B', ink:'#0E0E0E',
  ink2:'#3A3A3A', ink3:'#6B6B6B', ink4:'#9A9A9A',
  surface:'#F7F6F3', surface2:'#EFEDE8', surface3:'#E6E3DB',
  white:'#FDFCFA', border:'#E0DDD6',
  green:'#2D5016', greenL:'#EEF3E8', greenRule:'#C8D9B8',
  red:'#7F1D1D' }

export default function Dashboard() {
  const { company } = useAuth()
  const { entries, calcs, loading } = useEntries()
  const navigate = useNavigate()

  const lat    = entries[entries.length - 1]
  const latC   = calcs[calcs.length - 1]
  const prevC  = calcs[calcs.length - 2]
  const gef    = GRID_EF[company?.state] || 0.82
  const bench  = SECTOR_BENCHMARKS[company?.industry] || 7.0
  const totals = useMemo(() => sumEmissions(calcs), [calcs])
  const moM    = latC && prevC ? calcMoMChange(latC.total, prevC.total) : null
  const rev    = parseFloat(lat?.revenue_cr) || 0
  const intens = latC && rev > 0 ? latC.total / rev : null
  const intOK  = intens !== null && intens < bench

  const labels = calcs.map(c => format(parseISO(c.month), 'MMM yy'))

  const trendData = {
    labels,
    datasets: [
      { label:'Scope 1', data:calcs.map(c=>c.scope1), borderColor:S.s1, backgroundColor:S.s1+'18', fill:true, tension:.35, borderWidth:1.5, pointRadius:3, pointBackgroundColor:S.s1 },
      { label:'Scope 2', data:calcs.map(c=>c.scope2), borderColor:S.s2, backgroundColor:S.s2+'18', fill:true, tension:.35, borderWidth:1.5, pointRadius:3, pointBackgroundColor:S.s2 },
      { label:'Scope 3', data:calcs.map(c=>c.scope3), borderColor:S.s3, backgroundColor:S.s3+'18', fill:true, tension:.35, borderWidth:1.5, pointRadius:3, pointBackgroundColor:S.s3 },
    ],
  }

  const trendOpts = {
    responsive:true, maintainAspectRatio:false,
    interaction:{ intersect:false, mode:'index' },
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ ticks:{ font:{ size:10, family:'Inter' }, color:'#9A9A9A' }, grid:{ display:false }, border:{ display:false } },
      y:{ ticks:{ font:{ size:10, family:'Inter' }, color:'#9A9A9A', callback:v=>v.toFixed(1)+'t' }, grid:{ color:'#EFEDE8' }, border:{ display:false } },
    },
  }

  const donutTotal = latC ? (latC.scope1 + latC.scope2 + latC.scope3) || 1 : 1
  const donutData = {
    labels:['Scope 1','Scope 2','Scope 3'],
    datasets:[{ data: latC ? [latC.scope1, latC.scope2, latC.scope3] : [1,1,1],
      backgroundColor:[S.s1, S.s2, S.s3],
      borderWidth:3, borderColor:'#FDFCFA', hoverOffset:4 }],
  }

  const donutOpts = {
    responsive:true, maintainAspectRatio:false, cutout:'64%',
    plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>`${ctx.label}: ${ctx.raw?.toFixed(2)} tCO₂e` } } },
  }

  if (loading) return <Spinner message="Loading…" />
  if (!entries.length) return (
    <div>
      <PageHeader title="Dashboard" />
      <EmptyState title="No data yet" icon="—"
        desc="Enter your first month of operational data to see your emissions dashboard."
        action={<button className="btn-primary" onClick={()=>navigate('/data-entry')}>Enter first month</button>} />
    </div>
  )

  const kpis = [
    { label:'Total Emissions',       value:latC?.total.toFixed(2),  unit:'tCO₂e',
      sub: moM!==null ? `${moM>0?'+':''}${moM}% vs prior month` : 'Latest month',
      subColor: moM!==null?(moM>0?S.red:S.green):S.ink4,
      accentColor:S.ink, barWidth:65 },
    { label:'Scope 1 — Direct',      value:latC?.scope1.toFixed(2), unit:'tCO₂e',
      sub:'Combustion', accentColor:S.s1,
      barWidth:latC?Math.round(latC.scope1/latC.total*100):30 },
    { label:'Scope 2 — Electricity', value:latC?.scope2.toFixed(2), unit:'tCO₂e',
      sub:`${gef} kg/kWh · CEA 2024`, accentColor:S.s2,
      barWidth:latC?Math.round(latC.scope2/latC.total*100):40 },
    { label:'Scope 3 — Value Chain', value:latC?.scope3.toFixed(2), unit:'tCO₂e',
      sub:'Materials + logistics', accentColor:S.s3,
      barWidth:latC?Math.round(latC.scope3/latC.total*100):30 },
  ]

  // Fix: access sources via latC.sources (from calculateEmissions return value)
  const srcElec = latC?.sources?.electricity ?? latC?.electricity ?? 0
  const srcFuel = latC?.sources?.fuels       ?? latC?.fuels       ?? 0
  const srcMat  = latC?.sources?.materials   ?? latC?.materials   ?? 0
  const srcLog  = latC?.sources?.logistics   ?? latC?.logistics   ?? 0

  const sources = [
    { name:'Electricity',     value: srcElec, color:S.s2 },
    { name:'Fuel combustion', value: srcFuel, color:S.s1 },
    { name:'Raw materials',   value: srcMat,  color:S.s3 },
    { name:'Logistics',       value: srcLog,  color:'#1F5A3F' },
  ].sort((a,b) => b.value - a.value)

  const intensityPct = intens ? Math.min(100, intens/(bench*1.8)*100) : 0

  const mono = { fontFamily:"'JetBrains Mono',monospace" }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${format(parseISO(entries[0].report_month),'MMM yyyy')} – ${format(parseISO(lat.report_month),'MMM yyyy')} · ${entries.length} month${entries.length>1?'s':''} · ${company?.state} grid ${gef} kg CO₂/kWh`}
      />

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.25rem' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
        <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.5rem' }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
            textTransform:'uppercase', color:S.ink4, marginBottom:3 }}>Emissions Trend</div>
          <div style={{ fontSize:12, color:S.ink4, marginBottom:14 }}>Monthly tCO₂e by scope</div>
          <div style={{ display:'flex', gap:16, marginBottom:14 }}>
            {['Scope 1','Scope 2','Scope 3'].map((l,i)=>(
              <span key={l} style={{ display:'flex', alignItems:'center', gap:5,
                fontSize:11, color:S.ink3 }}>
                <span style={{ width:8, height:8, borderRadius:1,
                  background:[S.s1,S.s2,S.s3][i], display:'inline-block' }} />{l}
              </span>
            ))}
          </div>
          <div style={{ position:'relative', height:200 }}>
            <Line data={trendData} options={trendOpts} />
          </div>
        </div>

        <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.5rem' }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
            textTransform:'uppercase', color:S.ink4, marginBottom:3 }}>Scope Breakdown</div>
          <div style={{ fontSize:12, color:S.ink4, marginBottom:14 }}>
            {format(parseISO(lat.report_month),'MMMM yyyy')}
          </div>
          <div style={{ position:'relative', height:150 }}>
            <Doughnut data={donutData} options={donutOpts} />
          </div>
          <div style={{ marginTop:14 }}>
            {[['Scope 1',latC?.scope1,S.s1],['Scope 2',latC?.scope2,S.s2],['Scope 3',latC?.scope3,S.s3]].map(([l,v,c])=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                <div style={{ width:7, height:7, borderRadius:1, background:c, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:11.5, color:S.ink3 }}>{l}</span>
                <span style={{ fontSize:12, fontWeight:600, color:S.ink, ...mono }}>
                  {donutTotal>0?(v/donutTotal*100).toFixed(0):0}%
                </span>
                <span style={{ fontSize:11, color:S.ink4, ...mono, minWidth:50, textAlign:'right' }}>
                  {v?.toFixed(2)}t
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
        <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.5rem' }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
            textTransform:'uppercase', color:S.ink4, marginBottom:3 }}>Carbon Intensity</div>
          <div style={{ fontSize:12, color:S.ink4, marginBottom:16 }}>
            tCO₂e / ₹ crore vs. {company?.industry}
          </div>
          <div style={{ display:'flex', gap:32, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:30, fontWeight:500,
                fontFamily:"'Playfair Display',serif",
                color: intens===null ? S.ink3 : intOK ? S.green : S.red,
                lineHeight:1 }}>
                {intens!==null ? intens.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize:10, color:S.ink4, marginTop:4,
                textTransform:'uppercase', letterSpacing:'.05em' }}>Your company</div>
            </div>
            <div style={{ width:1, background:S.border, height:44, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:30, fontWeight:500,
                fontFamily:"'Playfair Display',serif", color:S.ink3, lineHeight:1 }}>{bench}</div>
              <div style={{ fontSize:10, color:S.ink4, marginTop:4,
                textTransform:'uppercase', letterSpacing:'.05em' }}>Sector average</div>
            </div>
          </div>
          <div style={{ height:2, background:S.surface3, borderRadius:1, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${intensityPct}%`,
              background: intOK ? S.green : S.red,
              borderRadius:1, transition:'width .6s' }} />
          </div>
          <div style={{ fontSize:11.5, fontWeight:500,
            color: intens===null ? S.ink4 : intOK ? S.green : S.red }}>
            {intens!==null
              ? intOK ? `${((1-intens/bench)*100).toFixed(0)}% below sector average`
                      : `${((intens/bench-1)*100).toFixed(0)}% above sector average`
              : 'Add revenue data to calculate'}
          </div>
        </div>

        <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.5rem' }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
            textTransform:'uppercase', color:S.ink4, marginBottom:3 }}>Emission Sources</div>
          <div style={{ fontSize:12, color:S.ink4, marginBottom:16 }}>
            {format(parseISO(lat.report_month),'MMMM yyyy')}
          </div>
          {sources.map(s=>(
            <SourceBar key={s.name} name={s.name} value={s.value} total={latC?.total||1} color={s.color} />
          ))}
          <button style={{ fontSize:12, color:S.green, fontWeight:500,
            background:'none', border:'none', cursor:'pointer', padding:0, marginTop:6 }}
            onClick={()=>navigate('/recommendations')}>
            View reduction actions
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4, padding:'1.5rem' }}>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
          textTransform:'uppercase', color:S.ink4, marginBottom:14 }}>All Months</div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr>
                {['Month','Total','Scope 1','Scope 2','Scope 3','t / ₹Cr','MoM'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'6px 10px',
                    borderBottom:`1px solid ${S.border}`, fontSize:10, fontWeight:600,
                    textTransform:'uppercase', letterSpacing:'.06em', color:S.ink4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e,i)=>{
                const c=calcs[i]; const p=calcs[i-1]
                const chg=p?calcMoMChange(c.total,p.total):null
                const r=parseFloat(e.revenue_cr)||0
                return (
                  <tr key={e.id} style={{ borderBottom:`1px solid ${S.surface2}` }}>
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{format(parseISO(e.report_month),'MMM yyyy')}</td>
                    <td style={{ padding:'8px 10px', fontWeight:600, ...mono }}>{c?.total.toFixed(2)}</td>
                    <td style={{ padding:'8px 10px', ...mono, color:S.s1 }}>{c?.scope1.toFixed(2)}</td>
                    <td style={{ padding:'8px 10px', ...mono, color:S.s2 }}>{c?.scope2.toFixed(2)}</td>
                    <td style={{ padding:'8px 10px', ...mono, color:S.s3 }}>{c?.scope3.toFixed(2)}</td>
                    <td style={{ padding:'8px 10px', ...mono, color:S.ink3 }}>{r>0&&c?(c.total/r).toFixed(2):'—'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      {chg!==null
                        ? <span style={{ fontSize:11, fontWeight:500,
                            color:chg>0?S.red:S.green }}>{chg>0?'+':''}{chg}%</span>
                        : <span style={{ fontSize:10, color:S.ink4 }}>baseline</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
