import { useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEntries } from '../../hooks/useEntries'
import { generateRecommendations } from '../../lib/recommendations'
import { extractFeatures, matchArchetype } from '../../lib/mlScoring'
import { PageHeader, Spinner, EmptyState, Tag } from '../ui'
import { useNavigate } from 'react-router-dom'

const S = { ink:'#0E0E0E', ink2:'#3A3A3A', ink3:'#6B6B6B', ink4:'#9A9A9A',
  surface:'#F7F6F3', white:'#FDFCFA', border:'#E0DDD6', surface3:'#E6E3DB',
  green:'#2D5016', greenL:'#EEF3E8', greenRule:'#C8D9B8',
  amber:'#92400E', amberL:'#FEF3E2',
  red:'#7F1D1D', redL:'#FEF2F2',
  blue:'#1E3A5F', blueL:'#EAF0F8' }

const DIFF = {
  Easy:   { bg:S.greenL, color:S.green },
  Medium: { bg:S.amberL, color:S.amber },
  Hard:   { bg:S.redL,   color:S.red   },
}

// ML score bar with confidence interval
function ScoreBar({ score, low, high, ci }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ fontSize:9, fontWeight:600, letterSpacing:'.08em',
          textTransform:'uppercase', color:S.ink4 }}>ML Relevance Score</div>
        <div style={{ fontSize:11, fontWeight:600, color:S.ink2,
          fontFamily:"'JetBrains Mono',monospace" }}>{score.toFixed(0)}</div>
      </div>
      {/* Track */}
      <div style={{ position:'relative', height:4, background:S.surface3, borderRadius:2 }}>
        {/* CI band */}
        <div style={{
          position:'absolute', height:'100%', borderRadius:2,
          left:`${low}%`, width:`${Math.max(0,high-low)}%`,
          background:'rgba(45,80,22,0.15)',
        }} />
        {/* Mean score fill */}
        <div style={{
          position:'absolute', height:'100%', borderRadius:2,
          left:0, width:`${score}%`, background:S.green,
        }} />
        {/* Mean marker */}
        <div style={{
          position:'absolute', top:-2, width:2, height:8,
          background:S.green, borderRadius:1,
          left:`calc(${score}% - 1px)`,
        }} />
      </div>
      <div style={{ fontSize:9, color:S.ink4, marginTop:3 }}>
        90% CI: {low.toFixed(0)}–{high.toFixed(0)} · ±{ci.toFixed(0)} uncertainty
      </div>
    </div>
  )
}

function RecCard({ rec, rank }) {
  const diff = DIFF[rec.difficulty] || DIFF.Medium
  return (
    <div style={{ background:S.white, border:`1px solid ${S.border}`,
      borderLeft:`3px solid ${rank<=2?S.ink:rank<=5?S.ink3:S.surface3}`,
      borderRadius:4, padding:'1.25rem 1.5rem', marginBottom:'0.875rem' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
          <span style={{ fontSize:10, fontWeight:600, color:S.ink4,
            fontFamily:"'JetBrains Mono',monospace", minWidth:20 }}>#{rank}</span>
          <div style={{ fontSize:14, fontWeight:500, color:S.ink,
            fontFamily:"'Playfair Display',serif", lineHeight:1.35 }}>
            {rec.title}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, marginLeft:12 }}>
          <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px',
            borderRadius:2, background:diff.bg, color:diff.color,
            letterSpacing:'.04em', textTransform:'uppercase' }}>{rec.difficulty}</span>
        </div>
      </div>

      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.07em',
        textTransform:'uppercase', color:S.ink4, marginBottom:8 }}>{rec.cat}</div>

      <p style={{ fontSize:12.5, color:S.ink2, lineHeight:1.65, marginBottom:14 }}>{rec.desc}</p>

      {/* Metrics */}
      <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:14,
        paddingBottom:14, borderBottom:`1px solid ${S.surface3}` }}>
        {rec.co2Save > 0 && (
          <div>
            <div style={{ fontSize:18, fontWeight:500, color:S.green,
              fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{rec.co2Save} t</div>
            <div style={{ fontSize:9, color:S.ink4, marginTop:3,
              textTransform:'uppercase', letterSpacing:'.06em' }}>CO₂e / year</div>
          </div>
        )}
        {rec.costSave > 0 && (
          <div>
            <div style={{ fontSize:18, fontWeight:500, color:'#1F5A3F',
              fontFamily:"'Playfair Display',serif", lineHeight:1 }}>
              ₹{(rec.costSave/100000).toFixed(1)}L
            </div>
            <div style={{ fontSize:9, color:S.ink4, marginTop:3,
              textTransform:'uppercase', letterSpacing:'.06em' }}>Annual saving</div>
          </div>
        )}
        <div>
          <div style={{ fontSize:18, fontWeight:500, color:S.ink2,
            fontFamily:"'Playfair Display',serif", lineHeight:1 }}>
            {rec.paybackMonths===0?'Immediate':rec.paybackMonths===null?'Strategic':`${rec.paybackMonths} mo`}
          </div>
          <div style={{ fontSize:9, color:S.ink4, marginTop:3,
            textTransform:'uppercase', letterSpacing:'.06em' }}>Payback</div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        {rec.tags.map(t => <Tag key={t} text={t} />)}
      </div>

      {/* ML score bar */}
      <ScoreBar
        score={rec.mlScore}
        low={rec.mlScoreLow}
        high={rec.mlScoreHigh}
        ci={rec.mlCI}
      />
    </div>
  )
}

export default function Recommendations() {
  const { company } = useAuth()
  const { entries, calcs, loading } = useEntries()
  const navigate = useNavigate()

  const { recs, archetype } = useMemo(() => {
    if (!entries.length || !calcs.length) return { recs:[], archetype:null }
    const latestEntry = entries[entries.length-1]
    const latestCalc  = calcs[calcs.length-1]
    const recs = generateRecommendations(latestEntry, latestCalc, company)
    const features = extractFeatures(latestCalc, latestEntry, company)
    const matches  = matchArchetype(features)
    return { recs, archetype: matches[0] }
  }, [entries, calcs, company])

  const totalCO2  = recs.reduce((s,r) => s+(r.co2Save||0), 0)
  const totalCost = recs.reduce((s,r) => s+(r.costSave||0), 0)
  const latCalc   = calcs[calcs.length-1]

  if (loading) return <Spinner message="Running ML scoring engine…" />
  if (!entries.length) return (
    <div>
      <PageHeader title="Recommendations" />
      <EmptyState title="No data to score"
        desc="Enter your first month of data so the ML engine can analyse your emission profile."
        action={<button className="btn-primary" onClick={()=>navigate('/data-entry')}>Enter first month</button>} />
    </div>
  )

  return (
    <div>
      <PageHeader title="Recommendations"
        subtitle={`${recs.length} opportunities scored by ML engine · Monte Carlo confidence intervals`} />

      {/* Archetype match */}
      {archetype && (
        <div style={{ background:S.white, border:`1px solid ${S.border}`, borderRadius:4,
          padding:'1rem 1.25rem', marginBottom:'1.25rem', display:'flex',
          justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.08em',
              textTransform:'uppercase', color:S.ink4, marginBottom:4 }}>
              Nearest Archetype Match
            </div>
            <div style={{ fontSize:13, fontWeight:500, color:S.ink }}>{archetype.name}</div>
            <div style={{ fontSize:11, color:S.ink3, marginTop:2 }}>
              Cosine similarity: <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>
                {archetype.similarity.toFixed(2)}
              </span> · Recommendations ranked by sector-weighted ML score
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:24, fontWeight:500, color:S.ink,
              fontFamily:"'Playfair Display',serif" }}>
              {(archetype.similarity * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize:10, color:S.ink4, textTransform:'uppercase',
              letterSpacing:'.06em' }}>Match</div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
        gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'CO₂e reduction potential', v:`${totalCO2.toFixed(0)} t`, sub:'per year · all actions', c:S.green },
          { label:'Annual cost savings',       v:`₹${(totalCost/100000).toFixed(0)}L`, sub:'combined estimate', c:S.blue },
          { label:'Reduction vs baseline',
            v:`${latCalc&&latCalc.total>0?(totalCO2/(latCalc.total*12)*100).toFixed(0):0}%`,
            sub:'of annual emissions', c:'#3B1F6B' },
        ].map(k => (
          <div key={k.label} style={{ background:S.white, border:`1px solid ${S.border}`,
            borderRadius:4, padding:'1.25rem', borderTop:`2px solid ${k.c}` }}>
            <div style={{ fontSize:10, fontWeight:500, letterSpacing:'.07em',
              textTransform:'uppercase', color:S.ink4, marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:500, color:k.c,
              fontFamily:"'Playfair Display',serif", lineHeight:1, marginBottom:4 }}>{k.v}</div>
            <div style={{ fontSize:11, color:S.ink4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Methodology note */}
      <div style={{ fontSize:11.5, color:S.ink3, marginBottom:'1.25rem', lineHeight:1.65,
        padding:'10px 14px', background:S.white, border:`1px solid ${S.border}`, borderRadius:4 }}>
        Recommendations are ranked by a multi-factor ML scoring model: CO₂ impact (weighted by your
        emission source distribution), financial ROI, payback speed, implementation ease, and sector
        relevance. Sector weights are calibrated from BEE MSME energy audit data 2022–23.
        Confidence intervals are computed via 200-iteration Monte Carlo simulation with ±10% input uncertainty.
      </div>

      {/* Ranked list */}
      <div style={{ fontSize:10, fontWeight:600, letterSpacing:'.1em', textTransform:'uppercase',
        color:S.ink4, marginBottom:12, paddingBottom:8,
        borderBottom:`1px solid ${S.surface3}` }}>
        Ranked by ML score — highest relevance first
      </div>
      {recs.map((rec, i) => <RecCard key={rec.id} rec={rec} rank={i+1} />)}
    </div>
  )
}
