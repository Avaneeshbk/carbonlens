const mono = { fontFamily:"'JetBrains Mono',monospace" }
const display = { fontFamily:"'Playfair Display',serif" }

export function KpiCard({ label, value, unit, sub, subColor, accentColor, barWidth }) {
  return (
    <div style={{
      background:'#FDFCFA', border:'1px solid #D8D4CC', borderRadius:6,
      padding:'1.5rem 1.75rem', position:'relative', overflow:'hidden',
    }} className="anim">
      <div style={{
        fontSize:11, fontWeight:700, letterSpacing:'.08em',
        textTransform:'uppercase', color:'#808080', marginBottom:10,
      }}>{label}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
        <span style={{
          fontSize:28, fontWeight:500, color:'#0A0A0A',
          ...display, lineHeight:1,
        }}>{value}</span>
        {unit && <span style={{ fontSize:12, color:'#808080', fontWeight:400 }}>{unit}</span>}
      </div>
      <div style={{ fontSize:12, color: subColor||'#808080', marginBottom:12, fontWeight:400 }}>{sub}</div>
      <div style={{ height:2, background:'#E0DDD6', borderRadius:1, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${barWidth||60}%`,
          background:accentColor||'#0A0A0A', borderRadius:1 }} />
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="anim" style={{ marginBottom:'2rem' }}>
      <h1 style={{
        ...display, fontSize:28, fontWeight:500, color:'#0A0A0A',
        marginBottom:7, letterSpacing:'-.01em', lineHeight:1.15,
      }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize:13, color:'#525252', lineHeight:1.6, fontWeight:400 }}>{subtitle}</p>
      )}
    </div>
  )
}

export function SourceBar({ name, value, total, color }) {
  const pct = total > 0 ? (value / total * 100) : 0
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:13.5, color:'#0A0A0A', fontWeight:500 }}>{name}</span>
        <span style={{ fontSize:13.5, fontWeight:600, color:'#0A0A0A', ...mono }}>
          {value.toFixed(2)} t
        </span>
      </div>
      <div style={{ height:3, background:'#E0DDD6', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct.toFixed(1)}%`,
          background:color, borderRadius:2, transition:'width .5s' }} />
      </div>
      <div style={{ fontSize:11.5, color:'#808080', marginTop:3 }}>{pct.toFixed(0)}% of total</div>
    </div>
  )
}

export function AlertBox({ type='info', icon, children }) {
  const cls = { info:'alert-info', success:'alert-success', warning:'alert-warning', danger:'alert-danger' }
  return (
    <div className={`alert ${cls[type]||'alert-info'}`}>
      {icon && <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>}
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ message='Loading…' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'5rem 0', gap:14 }}>
      <div style={{
        width:22, height:22, border:'2px solid #D8D4CC',
        borderTopColor:'#0A0A0A', borderRadius:'50%',
        animation:'spin .8s linear infinite',
      }} />
      <span style={{ fontSize:14, color:'#525252' }}>{message}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:'5rem 0', textAlign:'center' }}>
      {icon && <div style={{ fontSize:32, marginBottom:16, opacity:.2 }}>{icon}</div>}
      <div style={{ ...display, fontSize:20, fontWeight:500,
        color:'#0A0A0A', marginBottom:8 }}>{title}</div>
      <p style={{ fontSize:13.5, color:'#525252', maxWidth:320, marginBottom:24,
        lineHeight:1.65 }}>{desc}</p>
      {action}
    </div>
  )
}

export function Tag({ text }) {
  const map = {
    'Scope 1': { bg:'#FAF0E6', color:'#7A3410' },
    'Scope 2': { bg:'#EFF4FB', color:'#162B4A' },
    'Scope 3': { bg:'#EEE8FA', color:'#2E1660' },
  }
  const c = map[text] || { bg:'#E8F0DF', color:'#234010' }
  return (
    <span style={{
      fontSize:10.5, fontWeight:600, padding:'2px 9px', borderRadius:3,
      background:c.bg, color:c.color, letterSpacing:'.04em', textTransform:'uppercase',
    }}>{text}</span>
  )
}

export function ScopePill({ scope }) {
  const cfg = {
    1:{ bg:'#FAF0E6', color:'#7A3410', label:'Scope 1' },
    2:{ bg:'#EFF4FB', color:'#162B4A', label:'Scope 2' },
    3:{ bg:'#EEE8FA', color:'#2E1660', label:'Scope 3' },
  }[scope]
  return (
    <span style={{
      fontSize:10.5, fontWeight:600, padding:'2px 9px', borderRadius:3,
      background:cfg.bg, color:cfg.color, letterSpacing:'.04em', textTransform:'uppercase',
    }}>{cfg.label}</span>
  )
}
