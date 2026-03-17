import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { INDIA_STATES, INDUSTRY_SECTORS } from '../../lib/emissionFactors'

const STEPS = ['Company details', 'Location & sector']

const inp = (label, type, val, set, ph, hint) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:'block', fontSize:11, fontWeight:500, letterSpacing:'.06em',
      textTransform:'uppercase', color:'#6B6B6B', marginBottom:6 }}>{label}</label>
    <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
      style={{ width:'100%', padding:'9px 12px', border:'1px solid #E0DDD6', borderRadius:3,
        fontSize:13, outline:'none', background:'#FDFCFA', fontFamily:'Inter,sans-serif',
        boxSizing:'border-box' }} />
    {hint && <div style={{ fontSize:10.5, color:'#9A9A9A', marginTop:4 }}>{hint}</div>}
  </div>
)

export default function OnboardingPage() {
  const [step, setStep]     = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [form, setForm] = useState({
    name:'', gstin:'', address:'', phone:'',
    state:'Karnataka', industry:'Electronics & Engineering',
    employees:'', annual_turnover_cr:'',
  })
  const set = (f,v) => setForm(p=>({...p,[f]:v}))

  async function finish() {
    if (!form.name.trim()) { setError('Company name is required'); return }
    setSaving(true); setError('')
    try {
      const { data:{ user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const { data:company, error:e1 } = await supabase.from('companies').insert({
        name:                form.name.trim(),
        gstin:               form.gstin||null,
        address:             form.address||null,
        phone:               form.phone||null,
        state:               form.state,
        industry:            form.industry,
        employees:           parseInt(form.employees)||null,
        annual_turnover_cr:  parseFloat(form.annual_turnover_cr)||null,
        onboarding_complete: true,
      }).select().single()
      if (e1) throw e1

      const { error:e2 } = await supabase.from('profiles')
        .update({ company_id:company.id, role:'owner' }).eq('id',user.id)
      if (e2) throw e2

      window.location.href = '/dashboard'
    } catch (err) { setError(err.message); setSaving(false) }
  }

  const sel = (label, val, set, opts) => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:500, letterSpacing:'.06em',
        textTransform:'uppercase', color:'#6B6B6B', marginBottom:6 }}>{label}</label>
      <select value={val} onChange={e=>set(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid #E0DDD6', borderRadius:3,
          fontSize:13, outline:'none', background:'#FDFCFA', fontFamily:'Inter,sans-serif',
          boxSizing:'border-box', cursor:'pointer' }}>
        {opts.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#F7F6F3', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:440 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20,
            fontWeight:600, color:'#0E0E0E', marginBottom:4 }}>CarbonLens</div>
          <div style={{ fontSize:11, color:'#9A9A9A', letterSpacing:'.08em',
            textTransform:'uppercase' }}>Setup — Step {step+1} of {STEPS.length}</div>
        </div>

        {/* Step indicator */}
        <div style={{ display:'flex', gap:4, marginBottom:28 }}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{ flex:1, height:2, borderRadius:1,
              background: i<=step ? '#0E0E0E' : '#E0DDD6',
              transition:'background .2s' }} />
          ))}
        </div>

        <div style={{ background:'#FDFCFA', border:'1px solid #E0DDD6', borderRadius:4, padding:'1.75rem' }}>
          {step===0 && (
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20,
                fontWeight:500, color:'#0E0E0E', marginBottom:4 }}>Company details</div>
              <p style={{ fontSize:12.5, color:'#6B6B6B', marginBottom:20, lineHeight:1.6 }}>
                This information appears on your GHG compliance reports.
              </p>
              {inp('Company name *','text',form.name,v=>set('name',v),'e.g. Mehta Auto Components Pvt Ltd')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>{inp('GSTIN','text',form.gstin,v=>set('gstin',v),'29AABCM1234A1Z5')}</div>
                <div>{inp('Phone','text',form.phone,v=>set('phone',v),'+91 98765 43210')}</div>
              </div>
              {inp('Registered address','text',form.address,v=>set('address',v),'Industrial Area, Bengaluru')}
              {error && <div style={{ fontSize:12, color:'#7F1D1D', marginBottom:12 }}>{error}</div>}
              <button onClick={()=>{ if(!form.name.trim()){setError('Required');return} setError('');setStep(1) }}
                style={{ width:'100%', background:'#0E0E0E', color:'#FDFCFA', border:'none',
                  padding:'10px', borderRadius:3, fontSize:13, fontWeight:500, cursor:'pointer',
                  fontFamily:'Inter,sans-serif' }}>Continue</button>
            </div>
          )}

          {step===1 && (
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20,
                fontWeight:500, color:'#0E0E0E', marginBottom:4 }}>Location & sector</div>
              <p style={{ fontSize:12.5, color:'#6B6B6B', marginBottom:20, lineHeight:1.6 }}>
                Your state determines the CEA 2024 grid emission factor applied to Scope 2.
              </p>
              {sel('State / Union Territory *', form.state, v=>set('state',v), INDIA_STATES)}
              {sel('Industry sector *', form.industry, v=>set('industry',v), INDUSTRY_SECTORS)}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>{inp('Employees','number',form.employees,v=>set('employees',v),'180')}</div>
                <div>{inp('Turnover (₹ Crore)','number',form.annual_turnover_cr,v=>set('annual_turnover_cr',v),'120')}</div>
              </div>
              {error && <div style={{ fontSize:12, color:'#7F1D1D', background:'#FEF2F2',
                padding:'8px 12px', borderRadius:3, marginBottom:12 }}>{error}</div>}
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{setError('');setStep(0)}}
                  style={{ padding:'10px 16px', border:'1px solid #E0DDD6', borderRadius:3,
                    background:'transparent', fontSize:13, cursor:'pointer', color:'#6B6B6B',
                    fontFamily:'Inter,sans-serif' }}>Back</button>
                <button onClick={finish} disabled={saving}
                  style={{ flex:1, background: saving?'#555':'#0E0E0E', color:'#FDFCFA',
                    border:'none', padding:'10px', borderRadius:3, fontSize:13,
                    fontWeight:500, cursor:saving?'not-allowed':'pointer',
                    fontFamily:'Inter,sans-serif' }}>
                  {saving ? 'Setting up…' : 'Complete setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
