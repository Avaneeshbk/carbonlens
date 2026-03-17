import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { to:'/dashboard',       label:'Dashboard'      },
  { to:'/data-entry',      label:'Data Entry'     },
  { to:'/recommendations', label:'Recommendations'},
  { to:'/report',          label:'Report'         },
]

export default function Layout() {
  const { company, profile, signOut } = useAuth()
  return (
    <div style={{ display:'flex', height:'100%' }}>
      <aside style={{
        width:232, minWidth:232, height:'100vh',
        background:'#0A0A0A', display:'flex', flexDirection:'column',
        borderRight:'1px solid #1A1A1A',
      }}>
        <div style={{ padding:'36px 26px 26px' }}>
          <div style={{
            fontFamily:"'Playfair Display',serif",
            fontSize:22, fontWeight:500, color:'#FDFCFA',
            letterSpacing:'-.01em', lineHeight:1,
          }}>CarbonLens</div>
          <div style={{
            fontSize:9.5, color:'#404040', letterSpacing:'.12em',
            textTransform:'uppercase', marginTop:6,
          }}>India SME</div>
        </div>

        <div style={{ height:'1px', background:'#1E1E1E', margin:'0 22px 22px' }} />

        <div style={{ padding:'0 22px', marginBottom:28 }}>
          <div style={{
            fontSize:10, color:'#404040', letterSpacing:'.1em',
            textTransform:'uppercase', marginBottom:8, fontWeight:600,
          }}>Company</div>
          <div style={{
            fontSize:13, fontWeight:500, color:'#C8C4BC', lineHeight:1.45,
          }}>{company?.name || '—'}</div>
        </div>

        <nav style={{ flex:1, padding:'0 14px', overflowY:'auto' }}>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} style={{ textDecoration:'none' }}>
              {({ isActive }) => (
                <div style={{
                  padding:'10px 12px', borderRadius:4, marginBottom:3,
                  background: isActive ? '#1C1C1C' : 'transparent',
                  borderLeft:`2px solid ${isActive ? '#8BAF6A' : 'transparent'}`,
                  cursor:'pointer', transition:'all .1s',
                }}>
                  <div style={{
                    fontSize:13.5, fontWeight: isActive ? 500 : 400,
                    color: isActive ? '#E8E4DA' : '#606060',
                    lineHeight:1,
                  }}>{item.label}</div>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding:'18px 22px', borderTop:'1px solid #1A1A1A' }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:12, color:'#505050' }}>{profile?.full_name||'Account'}</div>
            <button onClick={signOut} style={{
              fontSize:11, color:'#404040', background:'none',
              border:'none', cursor:'pointer', letterSpacing:'.03em', padding:0,
            }}>Sign out</button>
          </div>
          <div style={{
            fontSize:9, color:'#2A3D1A', letterSpacing:'.07em', textTransform:'uppercase',
            background:'#111', border:'1px solid #1E2A14',
            padding:'6px 10px', borderRadius:3,
          }}>GHG Protocol · CEA 2024 · IPCC AR6</div>
        </div>
      </aside>

      <main style={{
        flex:1, height:'100vh', overflowY:'auto',
        padding:'2.75rem 3.25rem', background:'#F4F2EE',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
