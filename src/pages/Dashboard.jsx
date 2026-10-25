import { useMemo, useState } from 'react'
import {
  useRMS, productCost, ORDER_TYPE_LABELS, registerExpectedCash,
} from '../lib/rmsData'
import { Stat, Card, Badge, Select, useCurrency } from '../components/ui'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, UtensilsCrossed,
  Percent, Clock, Package, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { format, subDays, startOfDay, isSameDay } from 'date-fns'

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last 12 months' },
]

function stockSeverity(quantity) {
  if (quantity < 1) return { label: 'Critical', styles: 'border-red-200 bg-red-50 text-red-800' }
  if (quantity < 3) return { label: 'Low', styles: 'border-orange-200 bg-orange-50 text-orange-800' }
  return { label: 'Watch', styles: 'border-yellow-200 bg-yellow-50 text-yellow-800' }
}

function orderRevenueDate(order) {
  const date = new Date(order.completed_at || order.created_at)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfDayLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export default function Dashboard() {
  const s = useRMS()
  const cur = useCurrency()
  const [range, setRange] = useState('30')
  const [branchId, setBranchId] = useState('all')

  const orders = useMemo(
    () => s.orders.filter((o) => o.status === 'completed' && (branchId === 'all' || o.branch_id === branchId)),
    [s.orders, branchId]
  )
  const expenses = useMemo(
    () => s.expenses.filter((e) => e.status === 'approved' && (branchId === 'all' || e.branch_id === branchId)),
    [s.expenses, branchId]
  )

  const today = startOfDay(new Date())
  const yesterday = subDays(today, 1)

  const dayOrders = (day) => orders.filter((o) => {
    const date = orderRevenueDate(o)
    return date && isSameDay(date, day)
  })
  const revenue = (list) => list.reduce((sum, o) => sum + o.total, 0)

  const kpis = useMemo(() => {
    const tOrders = dayOrders(today)
    const yOrders = dayOrders(yesterday)
    const tRev = revenue(tOrders)
    const yRev = revenue(yOrders)
    const tCount = tOrders.length
    const aov = tCount ? tRev / tCount : 0

    // margins from product costs
    const cogsOf = (list) => list.reduce((sum, o) => sum + o.items.reduce((a, it) => {
      const p = s.products.find((x) => x.id === it.product_id)
      return a + (p ? productCost(s, p) * it.qty : 0)
    }, 0), 0)
    const tCogs = cogsOf(tOrders)
    const gross = tRev - tCogs
    const tExp = expenses.filter((e) => isSameDay(new Date(e.date), today)).reduce((sum, e) => sum + e.amount, 0)
    const labor = expenses.filter((e) => e.category === 'Salaries' && isSameDay(new Date(e.date), today)).reduce((sum, e) => sum + e.amount, 0)
    const net = gross - tExp
    const openSessions = s.register_sessions.filter((session) => {
      if (session.status !== 'open') return false
      if (branchId === 'all') return true
      return s.cash_registers.find((register) => register.id === session.register_id)?.branch_id === branchId
    })
    const cashOnHand = openSessions.reduce((sum, session) => sum + registerExpectedCash(s, session), 0)
    const pending = s.orders.filter((o) => !['completed', 'cancelled', 'refunded'].includes(o.status)).length

    return {
      tRev, yRev, revDelta: yRev ? ((tRev - yRev) / yRev) * 100 : 0,
      tCount, yCount: yOrders.length, countDelta: yOrders.length ? ((tCount - yOrders.length) / yOrders.length) * 100 : 0,
      aov,
      gross, net,
      foodCostPct: tRev ? (tCogs / tRev) * 100 : 0,
      laborPct: tRev ? (labor / tRev) * 100 : 0,
      tExp, cashOnHand, pending,
      lowStock: s.ingredients.filter((ingredient) => Number(ingredient.quantity) < 5).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, expenses, s.products, s.orders, s.register_sessions, s.cash_registers, s.cash_transactions, branchId])

  // Revenue over range
  const revData = useMemo(() => {
    const days = Number(range)
    const buckets = []
    if (days <= 30) {
      for (let i = days - 1; i >= 0; i--) {
        const d = subDays(today, i)
        buckets.push({ label: format(d, 'MMM d'), revenue: Math.round(revenue(dayOrders(d)) * 100) / 100 })
      }
    } else {
      const weeks = Math.ceil(days / 7)
      for (let i = weeks - 1; i >= 0; i--) {
        const end = subDays(today, i * 7)
        const start = subDays(end, 6)
        const rev = orders.filter((o) => {
          const date = orderRevenueDate(o)
          return date && date >= start && date <= endOfDayLocal(end)
        }).reduce((sum, o) => sum + o.total, 0)
        buckets.push({ label: `${format(start, 'MMM d')}`, revenue: Math.round(rev * 100) / 100 })
      }
    }
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, range])

  const typeData = useMemo(() => {
    const m = {}
    orders.forEach((o) => { const k = ORDER_TYPE_LABELS[o.type] || o.type; m[k] = (m[k] || 0) + o.total })
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [orders])

  const payData = useMemo(() => {
    const m = {}
    orders.forEach((o) => o.payments.forEach((p) => { m[p.method] = (m[p.method] || 0) + p.amount }))
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [orders])

  const topProducts = useMemo(() => {
    const m = {}
    orders.forEach((o) => o.items.forEach((it) => {
      if (!m[it.product_id]) m[it.product_id] = { name: it.name, qty: 0, revenue: 0 }
      m[it.product_id].qty += it.qty
      m[it.product_id].revenue += it.price * it.qty
    }))
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 6)
      .map((x) => ({ ...x, revenue: Math.round(x.revenue), profit: Math.round(x.revenue - x.qty * 0) }))
  }, [orders])

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => ({ hour: i + 9, label: `${i + 9}:00`, revenue: 0, orders: 0 }))
    orders.forEach((o) => {
      const date = orderRevenueDate(o)
      if (!date) return
      const h = date.getHours()
      const b = hours.find((x) => x.hour === h)
      if (b) { b.revenue += o.total; b.orders += 1 }
    })
    hours.forEach((b) => { b.revenue = Math.round(b.revenue) })
    return hours
  }, [orders])

  const dailyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => ({ day: d, revenue: 0 }))
    orders.forEach((o) => {
      const date = orderRevenueDate(o)
      if (date) days[date.getDay()].revenue += Number(o.total) || 0
    })
    days.forEach((d) => { d.revenue = Math.round(d.revenue) })
    return days
  }, [orders])

  const expenseData = useMemo(() => {
    const m = {}
    expenses.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount })
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [expenses])

  const profitability = useMemo(() => {
    const rev = orders.reduce((sum, o) => sum + o.total, 0)
    const cogs = orders.reduce((sum, o) => sum + o.items.reduce((a, it) => {
      const p = s.products.find((x) => x.id === it.product_id)
      return a + (p ? productCost(s, p) * it.qty : 0)
    }, 0), 0)
    const labor = expenses.filter((e) => e.category === 'Salaries').reduce((sum, e) => sum + e.amount, 0)
    const opex = expenses.filter((e) => e.category !== 'Salaries').reduce((sum, e) => sum + e.amount, 0)
    return { rev, cogs, labor, opex, net: rev - cogs - labor - opex }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, expenses])

  const tooltipStyle = { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }
  const Delta = ({ value }) => (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
      {value >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(value).toFixed(1)}% vs yesterday
    </span>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, MMM d yyyy')} · {s.settings.restaurant.name}</p>
        </div>
        <div className="flex gap-2">
          <Select value={branchId} onChange={setBranchId}
            options={[{ value: 'all', label: 'All Branches' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} />
          <Select value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={12} /> Today&apos;s Revenue</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{cur(kpis.tRev)}</p>
          <Delta value={kpis.revDelta} />
        </div></Card>
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Receipt size={12} /> Today&apos;s Orders</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{kpis.tCount}</p>
          <Delta value={kpis.countDelta} />
        </div></Card>
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><UtensilsCrossed size={12} /> Avg Order Value</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{cur(kpis.aov)}</p>
          <span className="text-xs text-gray-400">per order</span>
        </div></Card>
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={12} /> Gross Profit</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{cur(kpis.gross)}</p>
          <span className="text-xs text-gray-400">after COGS</span>
        </div></Card>
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Percent size={12} /> Net Profit</p>
          <p className={`text-xl font-bold mt-1 ${kpis.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{cur(kpis.net)}</p>
          <span className="text-xs text-gray-400">today, after expenses</span>
        </div></Card>
        <Card className="!p-0" pad={false}><div className="p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> Pending Orders</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{kpis.pending}</p>
          <span className="text-xs text-gray-400">in progress</span>
        </div></Card>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Food Cost %" value={`${kpis.foodCostPct.toFixed(1)}%`} tone={kpis.foodCostPct > 35 ? 'red' : 'green'} />
        <Stat label="Labor Cost %" value={`${kpis.laborPct.toFixed(1)}%`} tone={kpis.laborPct > 30 ? 'orange' : 'gray'} />
        <Stat label="Expenses Today" value={cur(kpis.tExp)} />
        <Stat label="Expected Cash on Hand" value={cur(kpis.cashOnHand)} sub="Opening cash + cash sales + cash in − cash out" tone="green" />
        <Stat label="Low Stock Items" value={kpis.lowStock} tone={kpis.lowStock ? 'orange' : 'gray'} />
        <Stat label="Inventory Value" value={cur(s.ingredients.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0))} />
      </div>

      {kpis.lowStock > 0 && (
        <Card title={`Low stock · ${kpis.lowStock} item${kpis.lowStock === 1 ? '' : 's'}`}>
          <div className="space-y-2 p-2">
            {s.ingredients
              .filter((ingredient) => Number(ingredient.quantity) < 5)
              .sort((a, b) => Number(a.quantity) - Number(b.quantity))
              .map((ingredient) => {
                const severity = stockSeverity(Number(ingredient.quantity) || 0)
                return (
                  <div key={ingredient.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${severity.styles}`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span className="truncate text-sm font-semibold">{ingredient.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span><strong>{ingredient.quantity}</strong> {ingredient.unit} remaining</span>
                      <span className="text-xs font-semibold uppercase">{severity.label}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Revenue chart */}
      <Card title="Revenue Growth" actions={<span className="text-xs text-gray-400">{RANGES.find((r) => r.value === range)?.label}</span>}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
              <Tooltip formatter={(v) => cur(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Sales by Order Type">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => cur(v)} contentStyle={tooltipStyle} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Payment Methods">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={payData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {payData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 2) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => cur(v)} contentStyle={tooltipStyle} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Sales by Hour">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip formatter={(v, name) => (name === 'revenue' ? cur(v) : v)} contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Sales by Day of Week">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <Tooltip formatter={(v) => cur(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Top Selling Products">
          <div className="space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.qty} sold</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{cur(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Expenses by Category">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {expenseData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 1) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => cur(v)} contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Profitability (Selected Period)">
          <div className="space-y-3 text-sm">
            <Row label="Revenue" value={cur(profitability.rev)} strong />
            <Row label="− Cost of Goods Sold" value={`(${cur(profitability.cogs)})`} />
            <Row label="= Gross Profit" value={cur(profitability.rev - profitability.cogs)} good />
            <Row label="− Labor" value={`(${cur(profitability.labor)})`} />
            <Row label="− Operating Expenses" value={`(${cur(profitability.opex)})`} />
            <div className="border-t border-gray-200 pt-3">
              <Row label="= Net Profit" value={cur(profitability.net)} strong good={profitability.net >= 0} bad={profitability.net < 0} />
              <p className="text-xs text-gray-400 mt-1">Net margin: {profitability.rev ? ((profitability.net / profitability.rev) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, strong, good, bad }) {
  return (
    <div className="flex justify-between">
      <span className={`${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`font-medium ${good ? 'text-emerald-600' : bad ? 'text-red-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}
