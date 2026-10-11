import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isDemoMode, demoAuth, db } from '../lib/supabase'
import { disconnectRMS, initializeRMS, reportRMSLoadError, update as updateRMS } from '../lib/rmsData'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemoMode) {
      demoAuth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    let active = true
    const loadRestaurantSettings = async () => {
      try {
        const { data, error } = await db('restaurants').select('*').eq('owner_id', user.id)
        if (error) throw error
        const restaurant = Array.isArray(data) ? data[0] : data
        if (!restaurant) throw new Error('No restaurant record is available for this account.')
        if (active) {
          await initializeRMS(user.id, restaurant.rms_data, restaurant.updated_at)
        }
        if (restaurant && active) {
          updateRMS((state) => {
            state.settings.restaurant = {
              ...state.settings.restaurant,
              name: restaurant.name,
              logo: restaurant.logo,
              address: restaurant.address,
              phone: restaurant.phone,
              email: restaurant.email,
              currency: restaurant.currency,
              timezone: restaurant.timezone,
            }
            state.settings.pos = { ...state.settings.pos, ...(restaurant.pos_settings || {}) }
            state.settings.inventory = { ...state.settings.inventory, ...(restaurant.inventory_settings || {}) }
            state.settings.loyalty = { ...state.settings.loyalty, ...(restaurant.loyalty_settings || {}) }
            state.settings.notifications = { ...state.settings.notifications, ...(restaurant.notification_settings || {}) }
            if (Array.isArray(restaurant.taxes)) state.taxes = restaurant.taxes
            if (Array.isArray(restaurant.roles)) state.roles = restaurant.roles
            if (Array.isArray(restaurant.users)) state.users = restaurant.users
          })
        }
      } catch (error) {
        reportRMSLoadError(error)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRestaurantSettings()
    return () => { active = false }
  }, [user?.id])

  const signUp = async (email, password, metadata = {}) => {
    if (isDemoMode) return demoAuth.signUp()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    if (isDemoMode) return demoAuth.signInWithPassword()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signOut = async () => {
    await disconnectRMS()
    if (isDemoMode) {
      await demoAuth.signOut()
      setUser(null)
      return { error: null }
    }
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
