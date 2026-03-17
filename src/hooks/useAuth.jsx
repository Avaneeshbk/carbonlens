import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', userId)
        .single()
      if (!error && data) {
        setProfile(data)
        setCompany(data.companies ?? null)
        return data
      }
    } catch (e) {
      console.error('fetchProfile:', e)
    }
    return null
  }

  useEffect(() => {
    let cancelled = false

    // Hard 6s timeout — UI always unblocks
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 6000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id).finally(() => {
          if (!cancelled) { clearTimeout(timeout); setLoading(false) }
        })
      } else {
        clearTimeout(timeout)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) { clearTimeout(timeout); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return
        if (!session?.user) {
          setUser(null); setProfile(null); setCompany(null)
        }
      }
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      setUser(data.user)
      await fetchProfile(data.user.id)
    }
  }

  async function signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setCompany(null)
    window.location.href = '/login'
  }

  async function updateCompany(updates) {
    if (!company) return
    const { data, error } = await supabase
      .from('companies').update(updates).eq('id', company.id).select().single()
    if (error) throw error
    setCompany(data)
    return data
  }

  return (
    <AuthContext.Provider value={{
      user, profile, company, loading,
      signIn, signUp, signOut, updateCompany,
      refreshProfile: () => user && fetchProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
