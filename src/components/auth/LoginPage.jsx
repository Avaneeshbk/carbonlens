import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth()
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setSubmitting(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        if (!fullName.trim()) { setError('Full name is required'); setSubmitting(false); return }
        await signUp(email, password, fullName)
        setError('Check your email to confirm, then sign in.')
        setMode('login')
      }
    } catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  const input = (label, type, val, set, ph) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:500, letterSpacing:'.06em',
        textTransform:'uppercase', color:'#6B6B6B', marginBottom:6 }}>{label}</label>
      <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
        required style={{ width:'100%', padding:'10px 12px', border:'1px solid #E0DDD6',
        borderRadius:3, fontSize:13, outline:'none', background:'#FDFCFA',
        fontFamily:'Inter,sans-serif', boxSizing:'border-box' }} />
    </div>
  )

  return (
    <div style={{ height:'100vh', display:'flex', background:'#F7F6F3' }}>
      {/* Left panel */}
      <div style={{ width:420, background:'#0E0E0E', display:'flex', flexDirection:'column',
        justifyContent:'space-between', padding:'52px 48px' }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20,
            fontWeight:600, color:'#FDFCFA', marginBottom:4 }}>CarbonLens</div>
          <div style={{ fontSize:10, color:'#444', letterSpacing:'.1em', textTransform:'uppercase' }}>
            India SME Platform
          </div>
        </div>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:38,
            fontWeight:500, color:'#FDFCFA', lineHeight:1.15, marginBottom:20 }}>
            Track.<br />Report.<br /><span style={{ color:'#8BAF6A' }}>Reduce.</span>
          </div>
          <p style={{ fontSize:13, color:'#555', lineHeight:1.7, marginBottom:32 }}>
            GHG Protocol-aligned carbon tracking for Indian manufacturers.
            EU CBAM ready. SEBI BRSR compliant.
          </p>
          {[
            'India-specific CEA 2024 emission factors for all 22 states',
            'Scope 1, 2 & 3 calculated from operational data',
            'One-click GHG Protocol + BRSR compliance reports',
            'Reduction recommendations with financial case',
          ].map(t => (
            <div key={t} style={{ display:'flex', gap:10, marginBottom:10 }}>
              <span style={{ color:'#8BAF6A', fontWeight:600, fontSize:12, marginTop:1, flexShrink:0 }}>—</span>
              <span style={{ fontSize:12, color:'#666', lineHeight:1.6 }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:10, color:'#333', letterSpacing:'.04em' }}>
          Row-level security · Encrypted at rest · Supabase
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
        <div style={{ width:'100%', maxWidth:380 }}>
          <div style={{ marginBottom:32 }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24,
              fontWeight:500, color:'#0E0E0E', marginBottom:6 }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p style={{ fontSize:13, color:'#6B6B6B' }}>
              {mode === 'login' ? 'No account? ' : 'Already registered? '}
              <button onClick={() => { setMode(mode==='login'?'signup':'login'); setError('') }}
                style={{ color:'#0E0E0E', fontWeight:500, background:'none',
                  border:'none', cursor:'pointer', textDecoration:'underline', fontSize:13 }}>
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && input('Full Name','text',fullName,setFullName,'Your name')}
            {input('Email','email',email,setEmail,'you@company.com')}
            {input('Password','password',password,setPassword,'Minimum 8 characters')}

            {error && (
              <div style={{ fontSize:12.5, padding:'10px 12px', borderRadius:3, marginBottom:16,
                background: error.includes('Check') ? '#EEF3E8' : '#FEF2F2',
                border: `1px solid ${error.includes('Check') ? '#C8D9B8' : '#FECACA'}`,
                color: error.includes('Check') ? '#2D5016' : '#7F1D1D' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting}
              style={{ width:'100%', background:'#0E0E0E', color:'#FDFCFA',
                border:'1px solid #0E0E0E', padding:'11px', borderRadius:3,
                fontSize:13, fontWeight:500, cursor:'pointer', letterSpacing:'.02em',
                fontFamily:'Inter,sans-serif' }}>
              {submitting ? 'Please wait…' : mode==='login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ fontSize:11, color:'#9A9A9A', textAlign:'center', marginTop:20 }}>
            By continuing you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  )
}
