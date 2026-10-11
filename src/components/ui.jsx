import { useEffect, useRef, useState } from 'react'
import { X, Search, Inbox } from 'lucide-react'
import { useRMS, update, fmt } from '../lib/rmsData'

// ---------- primitives ----------
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '', pad = true }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          {title && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
          {actions}
        </div>
      )}
      <div className={pad ? 'p-5 pt-2' : 'pb-2'}>{children}</div>
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'gray' }) {
  const tones = {
    gray: 'text-gray-900', green: 'text-emerald-600', red: 'text-red-600',
    blue: 'text-blue-600', orange: 'text-orange-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function Badge({ color = 'bg-gray-100 text-gray-600', children }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>
      {children}
    </span>
  )
}

export function Btn({ variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100',
    warn: 'bg-amber-500 text-white hover:bg-amber-600',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${className}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
      ))}
    </select>
  )
}

// ---------- modal ----------
export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.()
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Confirm({ open, onClose, onConfirm, title = 'Are you sure?', message, danger = true }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>Confirm</Btn>
      </>}>
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}

// ---------- table ----------
export function DataTable({ columns, rows, empty = 'No records found', footer }) {
  if (!rows.length) return <Empty text={empty} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            {columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-medium whitespace-nowrap">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className="border-b border-gray-50 hover:bg-gray-50/60">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 align-top">{c.render ? c.render(row, i) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  )
}

export function Empty({ text = 'Nothing here yet', sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <Inbox size={28} className="mb-2" />
      <p className="text-sm">{text}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${active === t.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`${inputCls} pl-9`} />
    </div>
  )
}

// ---------- toast ----------
let pushToast = () => { }
export function toast(msg, type = 'success') {
  pushToast(msg, type)
}

export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    pushToast = (msg, type) => {
      const id = Date.now() + Math.random()
      setItems((x) => [...x, { id, msg, type }])
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500)
    }
    return () => { pushToast = () => { } }
  }, [])
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' }
  return (
    <div className="fixed bottom-4 right-4 z-[60] space-y-2">
      {items.map((t) => (
        <div key={t.id} className={`${colors[t.type]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg`}>{t.msg}</div>
      ))}
    </div>
  )
}

// ---------- helpers ----------
export function useDebounce(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function useCurrency() {
  const s = useRMS()
  return (n) => fmt(n, s.settings.restaurant.currency)
}

export function markNotificationRead(id) {
  update((s) => { const n = s.notifications.find((x) => x.id === id); if (n) n.read = true })
}

// ---------- global search (Ctrl+K) ----------
const SEARCH_INDEX = [
  { label: 'Dashboard', path: '/dashboard', keys: 'home overview kpi' },
  { label: 'Point of Sale', path: '/pos', keys: 'pos register checkout order sell' },
  { label: 'Orders', path: '/orders', keys: 'orders list history' },
  { label: 'Tables / Floor', path: '/tables', keys: 'tables floor plan sections' },
  { label: 'Kitchen Display', path: '/kitchen', keys: 'kitchen kds stations tickets' },
  { label: 'Reservations', path: '/reservations', keys: 'reservations booking calendar' },
  { label: 'Menu', path: '/menu', keys: 'menu products categories recipes food cost' },
  { label: 'Inventory', path: '/inventory', keys: 'inventory stock ingredients stocktake low stock' },
  { label: 'Purchasing', path: '/purchasing', keys: 'purchase orders po receiving' },
  { label: 'Suppliers', path: '/suppliers', keys: 'suppliers vendors' },
  { label: 'Customers', path: '/customers', keys: 'customers crm loyalty points' },
  { label: 'Employees', path: '/employees', keys: 'employees staff attendance payroll' },
  { label: 'Cash Management', path: '/cash', keys: 'cash register sessions opening closing variance' },
  { label: 'Expenses', path: '/expenses', keys: 'expenses receipts approvals' },
  { label: 'Transactions', path: '/transactions', keys: 'transactions income expense cash flow' },
  { label: 'Sales Reports', path: '/reports', keys: 'reports sales export csv' },
  { label: 'Profit & Loss', path: '/pnl', keys: 'p&l profit loss statement' },
  { label: 'Analytics', path: '/analytics', keys: 'analytics growth trends insights' },
  { label: 'Tax Calculator', path: '/tax-calculator', keys: 'tax price before after percentage calculate' },
  { label: 'Promotions', path: '/promotions', keys: 'promotions discounts coupons' },
  { label: 'Branches', path: '/branches', keys: 'branches locations transfers' },
  { label: 'Notifications', path: '/notifications', keys: 'notifications alerts' },
  { label: 'Audit Logs', path: '/audit', keys: 'audit logs activity history' },
  { label: 'Notes & Bills', path: '/notes-bills', keys: 'notes bills reminders' },
  { label: 'Settings', path: '/settings', keys: 'settings taxes roles users restaurant configuration' },
]

export function GlobalSearch({ open, onClose, navigate }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const s = useRMS()
  useEffect(() => { if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])

  const dq = q.trim().toLowerCase()
  const pages = dq ? SEARCH_INDEX.filter((i) => (i.label + ' ' + i.keys).toLowerCase().includes(dq)).slice(0, 6) : []
  const orders = dq ? s.orders.filter((o) => o.number.toLowerCase().includes(dq)).slice(0, 4) : []
  const products = dq ? s.products.filter((p) => p.name.toLowerCase().includes(dq)).slice(0, 4) : []
  const customers = dq ? s.customers.filter((c) => c.name.toLowerCase().includes(dq)).slice(0, 4) : []
  const employees = dq ? s.employees.filter((e) => e.name.toLowerCase().includes(dq)).slice(0, 4) : []
  const suppliers = dq ? s.suppliers.filter((v) => v.name.toLowerCase().includes(dq)).slice(0, 4) : []
  const nothing = dq && !pages.length && !orders.length && !products.length && !customers.length && !employees.length && !suppliers.length

  return (
    <Modal open={open} onClose={onClose} title="Search" width="max-w-xl">
      <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, orders, products, customers…"
        className={inputCls} />
      <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
        {pages.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Pages</p>
            {pages.map((p) => (
              <button key={p.path} onClick={() => { navigate(p.path); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{p.label}</button>
            ))}
          </div>
        )}
        {orders.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Orders</p>
            {orders.map((o) => (
              <button key={o.id} onClick={() => { navigate('/orders'); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{o.number} · {fmt(o.total, s.settings.restaurant.currency)} · <span className="capitalize">{o.status}</span></button>
            ))}
          </div>
        )}
        {products.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Products</p>
            {products.map((p) => (
              <button key={p.id} onClick={() => { navigate('/menu'); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{p.emoji} {p.name} · {fmt(p.price, s.settings.restaurant.currency)}</button>
            ))}
          </div>
        )}
        {customers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Customers</p>
            {customers.map((c) => (
              <button key={c.id} onClick={() => { navigate('/customers'); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{c.name} · {c.segment}</button>
            ))}
          </div>
        )}
        {employees.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Employees</p>
            {employees.map((e) => (
              <button key={e.id} onClick={() => { navigate('/employees'); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{e.name} · {e.role}</button>
            ))}
          </div>
        )}
        {suppliers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1.5">Suppliers</p>
            {suppliers.map((v) => (
              <button key={v.id} onClick={() => { navigate('/suppliers'); onClose() }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-sm text-gray-700">{v.name}</button>
            ))}
          </div>
        )}
        {nothing && <p className="text-sm text-gray-400 text-center py-4">No results for “{q}”</p>}
      </div>
      <p className="text-xs text-gray-400 mt-4">Tip: press <kbd className="px-1 border border-gray-200 rounded">Ctrl</kbd>+<kbd className="px-1 border border-gray-200 rounded">K</kbd> anywhere to open search, <kbd className="px-1 border border-gray-200 rounded">Esc</kbd> to close.</p>
    </Modal>
  )
}
