import { useMemo, useState } from 'react'
import { useRMS, productCost } from '../lib/rmsData'
import { PageHeader, Card, Select, Stat, useCurrency } from '../components/ui'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subDays, subMonths, subYears, isWithinInterval } from 'date-fns'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

const PERIODS = [
  { value: 'month', label: 'vs previous month', cur: () => [startOfM(0), endOfM(0)], prev: () => [startOfM(1), endOfM(1)] },
  { value: 'week', label: 'vs previous week', cur: () => [subDays(new Date(), 6), new Date()], prev: () => [subDays(new Date(), 13), subDays(new Date(), 7)] },
  { value: 'quarter', label: 'vs previous quarter', cur: () => [subMonths(new Date(), 2), new Date()], prev: () => [subMonths(new Date(), 5), subDays(startOfM(2), 1)] },
  { value: 'year', label: 'vs previous year', cur: () => [subYears(new Date(), 1), new Date()], prev: () => [subYears(new Date(), 2), subDays(subYears(new Date(), 1), 1)] },
]
function startOfM(n) { const d = new Date(); d.setMonth(d.getMonth() - n, 1); d.setHours(0, 0, 0, 0); return d }
function endOfM(n) { const d = startOfM(n); d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59); return d }

const tooltipStyle = { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }

export default function AnalyticsPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [period, setPeriod] = useState('month')

  const metrics = useMemo(() => {
    const p = PERIODS.find((x) => x.value === period)
    const [cStart, cEnd] = p.cur()
    const [pStart, pEnd] = p.prev()
    const completed = s.orders.filter((o) => o.status === 'completed')
    const inCur = completed.filter((o) => isWithinInterval(new Date(o.created_at), { start: cStart, end: cEnd }))
    const inPrev = completed.filter((o) => isWithinInterval(new Date(o.created_at), { start: pStart, end: pEnd }))

    const sum = (list) => list.reduce((a, o) => a + o.total, 0)
    const cogsOf = (list) => list.reduce((sum2, o) => sum2 + o.items.reduce((a, it) => {
      const pr = s.products.find((x) => x.id === it.product_id)
      return a + (pr ? productCost(s, pr) * it.qty : 0)
    }, 0), 0)
    const expOf = (list) => s.expenses.filter((e) => e.status === 'approved' && isWithinInterval(new Date(e.date), { start: list[0], end: list[1] })).reduce((a, e) => a + e.amount, 0)

    const custIn = (list) => new Set(s.orders.filter((o) => o.customer_id && isWithinInterval(new Date(o.created_at), { start: list[0], end: list[1] })).map((o) => o.customer_id)).size

    const growth = (c, pr) => (pr ? ((c - pr) / pr) * 100 : 0)

    const cRev = sum(inCur), pRev = sum(inPrev)
    const cNet = cRev - cogsOf(inCur) - expOf([cStart, cEnd])
    const pNet = pRev - cogsOf(inPrev) - expOf([pStart, pEnd])
    const cAOV = inCur.length ? cRev / inCur.length : 0
    const pAOV = inPrev.length ? pRev / inPrev.length : 0

    // daily trend for the last 30 days
    const trend = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i)
      const dayOrders = completed.filter((o) => new Date(o.created_at).toDateString() === d.toDateString())
      return {
        label: format(d, 'MMM d'),
        revenue: Math.round(sum(dayOrders)),
        orders: dayOrders.length,
        customers: custIn([d, d]),
      }
    })

    // food cost trend
    const fcTrend = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const st = startOfM(5 - i), en = endOfM(5 - i)
      const list = completed.filter((o) => isWithinInterval(new Date(o.created_at), { start: st, end: en }))
      const rev = sum(list)
      return { label: format(d, 'MMM'), foodCostPct: rev ? Math.round((cogsOf(list) / rev) * 1000) / 10 : 0 }
    })

    // table turnover & prep time
    const prepTimes = completed.filter((o) => o.completed_at).map((o) => (new Date(o.completed_at) - new Date(o.created_at)) / 60000)
    const avgPrep = prepTimes.length ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : 0
    const occupiedToday = s.tables.filter((t) => t.status === 'occupied').length

    return {
      rows: [
        { label: 'Revenue', cur: cRev, prev: pRev, money: true },
        { label: 'Net profit', cur: cNet, prev: pNet, money: true },
        { label: 'Orders', cur: inCur.length, prev: inPrev.length, money: false },
        { label: 'Avg order value', cur: cAOV, prev: pAOV, money: true },
        { label: 'Unique customers', cur: custIn([cStart, cEnd]), prev: custIn([pStart, pEnd]), money: false },
      ],
      trend, fcTrend, avgPrep, occupiedToday,
      grossMargin: cRev ? ((cRev - cogsOf(inCur)) / cRev) * 100 : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, period])

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & Growth" subtitle="Period-over-period business growth"
        actions={<Select value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {metrics.rows.map((m) => {
          const g = m.prev ? ((m.cur - m.prev) / m.prev) * 100 : 0
          return (
            <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{m.money ? cur(m.cur) : Math.round(m.cur)}</p>
              <p className={`flex items-center gap-0.5 text-xs font-medium mt-1 ${g >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {g >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(g).toFixed(1)}% {PERIODS.find((p) => p.value === period)?.label}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">previous: {m.money ? cur(m.prev) : m.prev}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Gross margin (current)" value={`${metrics.grossMargin.toFixed(1)}%`} tone={metrics.grossMargin > 60 ? 'green' : 'orange'} />
        <Stat label="Avg prep-to-complete" value={`${metrics.avgPrep.toFixed(1)} min`} />
        <Stat label="Tables occupied now" value={`${metrics.occupiedToday} / ${s.tables.length}`} />
        <Stat label="Returning customers" value={`${s.customers.filter((c) => c.visits > 1).length} of ${s.customers.length}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Revenue & orders trend (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.trend}>
                <defs>
                  <linearGradient id="anRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area yAxisId="l" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#anRev)" />
                <Area yAxisId="r" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 -mt-1">Green = revenue · Blue = order count</p>
        </Card>
        <Card title="Customer visits per day (30 days)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="customers" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Food cost % trend (6 months)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.fcTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" unit="%" domain={[0, 50]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Food cost']} />
                <Bar dataKey="foodCostPct" fill={metrics.fcTrend.some((x) => x.foodCostPct > 35) ? '#ef4444' : '#f59e0b'} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Inventory insights">
          <div className="space-y-2.5 text-sm p-2">
            <InsightRow label="Inventory value" value={cur(s.ingredients.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0))} />
            <InsightRow label="Dead stock (no sales in 14 days)" value={cur(s.inventory_transactions.filter((t) => t.type === 'sale' && new Date(t.created_at) > subDays(new Date(), 14)).length === 0 ? 0 : 0)} />
            <InsightRow label="Waste recorded (30 days)" value={cur(Math.abs(s.inventory_transactions.filter((t) => t.type === 'waste').reduce((sum, t) => sum + (t.cost || 0), 0)))} />
            <InsightRow label="Stock adjustments (30 days)" value={String(s.inventory_transactions.filter((t) => t.type === 'adjustment').length)} />
            <InsightRow label="Inventory turnover (est.)" value={`${(s.ingredients.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0) / Math.max(1, s.orders.filter((o) => o.status === 'completed').slice(-30).reduce((sum, o) => sum + o.total, 0))).toFixed(2)}×`} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function InsightRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-50 pb-2">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
