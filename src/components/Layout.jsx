import { useAuth } from '../context/AuthContext'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, List, FileText, LogOut, UtensilsCrossed, Menu, X,
  ShoppingCart, StickyNote, Settings, Receipt, ClipboardList, Grid3X3,
  ChefHat, CalendarDays, BookOpen, Package, ShoppingBag, Truck, Users,
  UserCog, Wallet, Landmark, BarChart3, PieChart, TrendingUp, Tag,
  GitBranch, Bell, ScrollText, Search, Sun, Moon, MonitorSmartphone, Calculator, ChevronDown, Megaphone,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { GlobalSearch, ToastHost, markNotificationRead } from './ui'
import { useRMS, useRMSPersistence, resetDemoData } from '../lib/rmsData'

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/pos', label: 'Point of Sale', icon: MonitorSmartphone },
      { path: '/orders', label: 'Orders', icon: Receipt },
      { path: '/tables', label: 'Tables', icon: Grid3X3 },
      { path: '/kitchen', label: 'Kitchen Display', icon: ChefHat },
      { path: '/reservations', label: 'Reservations', icon: CalendarDays },
    ],
  },
  {
    label: 'Menu & Stock',
    items: [
      { path: '/menu', label: 'Menu', icon: BookOpen },
      { path: '/inventory', label: 'Inventory', icon: Package },
      { path: '/purchasing', label: 'Purchasing', icon: ShoppingBag },
      { path: '/suppliers', label: 'Suppliers', icon: Truck },
    ],
  },
  {
    label: 'People',
    items: [
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/employees', label: 'Employees', icon: UserCog },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/cash', label: 'Cash Management', icon: Landmark },
      { path: '/expenses', label: 'Expenses', icon: Wallet },
      { path: '/debts', label: 'Debt Tracker', icon: Landmark },
      { path: '/transactions', label: 'Cash Flow Log', icon: List },
      { path: '/reports', label: 'Sales Reports', icon: BarChart3 },
      { path: '/pnl', label: 'Profit & Loss', icon: PieChart },
      { path: '/analytics', label: 'Analytics', icon: TrendingUp },
      { path: '/tax-calculator', label: 'Tax Calculator', icon: Calculator },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { path: '/marketing', label: 'Marketing Hub', icon: Megaphone },
      { path: '/promotions', label: 'Promotions & Discounts', icon: Tag },
    ],
  },
  {
    label: 'Organization',
    items: [
      { path: '/branches', label: 'Branches', icon: GitBranch },
      { path: '/notifications', label: 'Notifications', icon: Bell },
      { path: '/audit', label: 'Audit Logs', icon: ScrollText },
      { path: '/notes-bills', label: 'Notes & Bills', icon: StickyNote },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const THEME_KEY = 'rms_theme'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroup, setOpenGroup] = useState(() => NAV_GROUPS.find((group) => group.items.some((item) => location.pathname.startsWith(item.path)))?.label || NAV_GROUPS[0].label)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === 'dark')
  const s = useRMS()
  const syncStatus = useRMSPersistence()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => location.pathname.startsWith(item.path)))
    if (activeGroup) setOpenGroup(activeGroup.label)
  }, [location.pathname])

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigate('/auth')
  }

  const unread = s.notifications.filter((n) => !n.read).length
  const restaurantName = s.settings?.restaurant?.name || 'CashFlow'
  const syncLabel = {
    local: 'Saved locally',
    connecting: 'Connecting to database',
    saving: 'Saving changes',
    saved: 'Saved to database',
    error: 'Database save failed',
  }[syncStatus]

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
          <UtensilsCrossed size={22} />
          <span>{restaurantName}</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${mobileOpen ? 'block' : 'hidden'} md:flex md:flex-col md:overflow-hidden md:h-screen md:sticky md:top-0 w-full md:w-60 lg:w-64 bg-white border-r border-gray-200 flex-shrink-0`}>
        <div className="p-5 hidden md:flex items-center gap-2 text-emerald-700 font-bold text-lg">
          <UtensilsCrossed size={22} />
          <span className="truncate">{restaurantName}</span>
        </div>

        <nav className="mt-1 px-3 pb-6 space-y-4 md:flex-1 md:min-h-0 md:overflow-y-auto">
          {NAV_GROUPS.map((g) => (
            <section key={g.label}>
              <button type="button" onClick={() => setOpenGroup(openGroup === g.label ? null : g.label)}
                aria-expanded={openGroup === g.label} aria-controls={`nav-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="w-full flex items-center justify-between px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-700">
                <span>{g.label}</span>
                <ChevronDown size={14} className={`transition-transform ${openGroup === g.label ? 'rotate-180' : ''}`} />
              </button>
              {openGroup === g.label && (
                <div id={`nav-${g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="mt-1 space-y-0.5">
                  {g.items.map((item) => {
                    const active = location.pathname.startsWith(item.path)
                    const Icon = item.icon
                    return (
                      <button key={item.path} onClick={() => { navigate(item.path); setMobileOpen(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                        <Icon size={17} />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-gray-200 bg-white">
          <div className="px-4 py-1 text-xs text-gray-500 truncate">{user?.email}</div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="hidden md:flex items-center justify-between gap-3 bg-white border-b border-gray-200 px-6 py-2.5 sticky top-0 z-30">
          <button onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 text-sm text-gray-400 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-1.5 w-72 border border-gray-200">
            <Search size={15} />
            <span>Search…</span>
            <kbd className="ml-auto text-[10px] border border-gray-200 rounded px-1 bg-white">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`mr-2 flex items-center gap-1.5 text-xs ${syncStatus === 'error' ? 'text-red-600' : 'text-gray-500'}`} role="status" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${syncStatus === 'error' ? 'bg-red-500' : syncStatus === 'saving' || syncStatus === 'connecting' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              {syncLabel}
            </span>
            <button onClick={() => setDark(!dark)} title="Toggle dark mode"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} title="Notifications"
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
                <Bell size={17} />
                {unread > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">{unread}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">Notifications</p>
                      <button onClick={() => { s.notifications.forEach((n) => markNotificationRead(n.id)); setNotifOpen(false); navigate('/notifications') }}
                        className="text-xs text-emerald-600 hover:underline">View all</button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {s.notifications.slice(0, 6).map((n) => (
                        <button key={n.id} onClick={() => markNotificationRead(n.id)}
                          className={`w-full text-left px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 ${n.read ? 'opacity-60' : ''}`}>
                          <p className="text-xs text-gray-700">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                        </button>
                      ))}
                      {!s.notifications.length && <p className="text-sm text-gray-400 text-center py-6">No notifications</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} />
      <ToastHost />
    </div>
  )
}
