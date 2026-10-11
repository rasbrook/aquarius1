import { createClient } from '@supabase/supabase-js'
import { DEMO_PROFILE, DEMO_RESTAURANT, DEMO_TRANSACTIONS, DEMO_SALES, DEMO_BILLS, DEMO_NOTES } from './demoData'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const hasCredentials = supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'demo')
export const isDemoMode = !hasCredentials

// Demo-mode local storage helpers
const DEMO_LS_KEY = 'rcf_demo_transactions'
const DEMO_SALES_KEY = 'rcf_demo_sales'
const DEMO_BILLS_KEY = 'rcf_demo_bills'
const DEMO_NOTES_KEY = 'rcf_demo_notes'
const DEMO_USER_KEY = 'rcf_demo_user'
const DEMO_RESTAURANT_KEY = 'rcf_demo_restaurants'

function getDemoData(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    // Safety: ensure table data is always an array
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback
    return parsed
  } catch { return fallback }
}

function setDemoData(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

// ============================================================
// DEMO QUERY BUILDER — mirrors Supabase chainable API
// ============================================================
class DemoQueryBuilder {
  constructor(tableName) {
    this.table = tableName
    this.filters = []
    this.orderField = null
    this.orderOpts = null
    this._updates = null
    this._insertRows = null
    this._deleteMode = false
  }

  select() {
    return this
  }

  eq(field, value) {
    this.filters.push({ field, value })
    return this
  }

  order(field, opts = {}) {
    this.orderField = field
    this.orderOpts = opts
    return this
  }

  insert(rows) {
    this._insertRows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  update(updates) {
    this._updates = updates
    return this
  }

  delete() {
    this._deleteMode = true
    return this
  }

  // This makes the object "thenable" — works with await
  then(onResolve, onReject) {
    try {
      const result = this._execute()
      onResolve(result)
    } catch (err) {
      onReject ? onReject(err) : onResolve({ data: null, error: err })
    }
  }

  _execute() {
    const data = getDemoData(this._storageKey(), this._fallback())
    let working = Array.isArray(data) ? [...data] : data ? [data] : []

    // Apply filters
    for (const f of this.filters) {
      working = working.filter((row) => row[f.field] === f.value)
    }

    // Apply ordering
    if (this.orderField) {
      const asc = this.orderOpts?.ascending !== false
      working.sort((a, b) => {
        let av = a[this.orderField]
        let bv = b[this.orderField]
        if (typeof av === 'number') av = Number(av)
        if (typeof bv === 'number') bv = Number(bv)
        if (av instanceof Date || bv instanceof Date || /date|_at$/.test(this.orderField)) {
          av = new Date(av)
          bv = new Date(bv)
        }
        if (av < bv) return asc ? -1 : 1
        if (av > bv) return asc ? 1 : -1
        return 0
      })
    }

    // INSERT
    if (this._insertRows) {
      const newRows = this._insertRows.map((r) => ({
        ...r,
        id: r.id || `demo-${this.table}-${Math.random().toString(36).slice(2, 10)}`,
        created_at: r.created_at || new Date().toISOString(),
      }))
      setDemoData(this._storageKey(), [...data, ...newRows])
      return { data: newRows.length === 1 ? newRows[0] : newRows, error: null }
    }

    // UPDATE
    if (this._updates) {
      if (this.filters.length > 0) {
        if (this.table === 'profiles') {
          const matches = (row) => this.filters.every((filter) => row[filter.field] === filter.value)
          const profile = Array.isArray(data) ? data.find(matches) : data
          if (profile && matches(profile)) setDemoData(this._storageKey(), { ...profile, ...this._updates })
          return { data: null, error: null }
        }
        const updated = data.map((row) =>
          this.filters.every((filter) => row[filter.field] === filter.value)
            ? { ...row, ...this._updates }
            : row
        )
        setDemoData(this._storageKey(), updated)
      }
      return { data: null, error: null }
    }

    // DELETE
    if (this._deleteMode) {
      let matchValue = null
      for (const f of this.filters) {
        if (f.field === 'id') {
          matchValue = f.value
          break
        }
      }
      if (matchValue !== null) {
        const filtered = data.filter((row) => row.id !== matchValue)
        setDemoData(this._storageKey(), filtered)
      }
      return { data: null, error: null }
    }

    // SELECT (default)
    return { data: working, error: null }
  }

  _storageKey() {
    const map = {
      profiles: DEMO_USER_KEY,
      restaurants: DEMO_RESTAURANT_KEY,
      transactions: DEMO_LS_KEY,
      sales: DEMO_SALES_KEY,
      bills: DEMO_BILLS_KEY,
      notes: DEMO_NOTES_KEY,
    }
    return map[this.table] || DEMO_LS_KEY
  }

  _fallback() {
    const map = {
      profiles: DEMO_PROFILE,
      restaurants: [DEMO_RESTAURANT],
      transactions: DEMO_TRANSACTIONS,
      sales: DEMO_SALES,
      bills: DEMO_BILLS,
      notes: DEMO_NOTES,
    }
    return map[this.table] || []
  }
}

// ============================================================
// DEMO AUTH — mirrors Supabase auth API
// ============================================================
class DemoAuth {
  async getSession() {
    const user = getDemoData(DEMO_USER_KEY, DEMO_PROFILE)
    return {
      data: {
        session: {
          user: { ...user, id: user.id || 'demo-user-id' },
        },
      },
      error: null,
    }
  }

  onAuthStateChange(callback) {
    return {
      data: {
        subscription: {
          unsubscribe: () => { },
        },
      },
    }
  }

  async signUp() {
    return { data: null, error: new Error('Sign up requires Supabase credentials. The app is in demo mode.') }
  }

  async signInWithPassword() {
    return { data: null, error: new Error('Sign in requires Supabase credentials. The app is in demo mode.') }
  }

  async signOut() {
    localStorage.removeItem(DEMO_USER_KEY)
    localStorage.removeItem(DEMO_RESTAURANT_KEY)
    localStorage.removeItem(DEMO_LS_KEY)
    localStorage.removeItem(DEMO_SALES_KEY)
    localStorage.removeItem(DEMO_BILLS_KEY)
    localStorage.removeItem(DEMO_NOTES_KEY)
    return { error: null }
  }
}

// ============================================================
// UNIFIED DB HELPER
// ============================================================
export function db(tableName) {
  if (!isDemoMode) {
    return supabase.from(tableName)
  }
  if (tableName === 'profiles') {
    return new DemoQueryBuilder('profiles')
  }
  return new DemoQueryBuilder(tableName)
}

export const demoAuth = new DemoAuth()
