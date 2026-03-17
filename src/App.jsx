import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import LoginPage from './components/auth/LoginPage'
import OnboardingPage from './components/auth/OnboardingPage'
import Dashboard from './components/dashboard/Dashboard'
import DataEntry from './components/data-entry/DataEntry'
import Recommendations from './components/recommendations/Recommendations'
import Report from './components/report/Report'

function Spinner() {
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', background:'#F0F7F2', gap:12 }}>
      <div style={{ width:48, height:48, borderRadius:12, fontSize:26,
        background:'linear-gradient(135deg,#4ADE80,#15803D)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>🌿</div>
      <div style={{ fontSize:14, color:'#4B7460', fontWeight:500 }}>Loading CarbonLens…</div>
    </div>
  )
}

export default function App() {
  const { user, company, loading } = useAuth()

  if (loading) return <Spinner />

  // Not logged in
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Logged in but no company yet → onboarding
  if (!company) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  // Fully set up → app
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index                  element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"       element={<Dashboard />} />
        <Route path="data-entry"      element={<DataEntry />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="report"          element={<Report />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
