import { useMemo, useState } from 'react'
import { useRMS, productCost } from '../lib/rmsData'
import { PageHeader, Card, Select, useCurrency } from '../components/ui'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

function Line({ label, value, indent = 0, bold = false, tone = 'text-gray-700' }) {
  return (
    <div className={`flex justify-between py-1.5 ${indent ? `pl-${indent * 4}` : ''}`}>
      <span className={bold ? 'font-bold text-gray-900' : tone}>{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : tone}>{value}</span>
    </div>
  )
}

export default function PnlPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [monthsBack, setMonthsBack] = useState('0')

  const period = useMemo(() => {
    const now = new Date()
    const d = subMonths(now, Number(monthsBack))
    return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, 'MMMM yyyy') }
  }, [monthsBack])

  const data = useMemo(() => {
    const inRange = (d) => { const x = new Date(d); return x >= period.start && x <= period.end }
    const orders = s.orders.filter((o) => o.status === 'completed' && inRange(o.created_at))
    const revenue = orders.reduce((sum, o) => sum + o.subtotal, 0)
    const discounts = orders.reduce((sum, o) => sum + (o.discount || 0), 0)
    const refunds = orders.filter((o) => o.status === 'refunded' && inRange(o.created_at)).reduce((sum, o) => sum + o.total, 0)
    const netSales = revenue - discounts - refunds
    const cogs = orders.reduce((sum, o) => sum + o.items.reduce((a, it) => {
      const p = s.products.find((x) => x.id === it.product_id)
      return a + (p ? productCost(s, p) * it.qty : 0)
    }, 0), 0)
    const grossProfit = netSales - cogs
    const expenses = s.expenses.filter((e) => e.status === 'approved' && inRange(e.date))
    const labor = expenses.filter((e) => e.category === 'Salaries').reduce((sum, e) => sum + e.amount, 0)
    const opexByCat = {}
    expenses.filter((e) => e.category !== 'Salaries').forEach((e) => { opexByCat[e.category] = (opexByCat[e.category] || 0) + e.amount })
    const opex = Object.values(opexByCat).reduce((sum, x) => sum + x, 0)
    const netProfit = grossProfit - labor - opex
    return {
      orders, revenue, discounts, refunds, netSales, cogs, grossProfit, labor, opexByCat, opex, netProfit,
      taxCollected: orders.reduce((sum, o) => sum + (o.tax || 0), 0),
      orderCount: orders.length,
    }
  }, [s, period])

  const fmtPct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : '0.0%')

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Profit & Loss" subtitle="Income statement by period"
        actions={<Select value={monthsBack} onChange={setMonthsBack}
          options={Array.from({ length: 6 }, (_, i) => { const d = subMonths(new Date(), i); return { value: String(i), label: format(d, 'MMMM yyyy') } })} />} />

      <Card title={`Statement — ${period.label}`}>
        <div className="p-2">
          <Section title="Revenue" />
          <Line label="Gross sales" value={cur(data.revenue)} />
          <Line label="− Discounts" value={`(${cur(data.discounts)})`} />
          <Line label="− Refunds" value={`(${cur(data.refunds)})`} />
          <Subtotal label="Net Sales" value={cur(data.netSales)} />

          <Section title="Cost of Goods Sold" />
          <Line label="− Ingredient / product costs" value={`(${cur(data.cogs)})`} />
          <Subtotal label="Gross Profit" value={cur(data.grossProfit)} extra={`Gross margin ${fmtPct(data.grossProfit, data.netSales)}`} />

          <Section title="Operating Expenses" />
          <Line label="− Labor (salaries)" value={`(${cur(data.labor)})`} />
          {Object.entries(data.opexByCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <Line key={cat} label={`− ${cat}`} value={`(${cur(amt)})`} indent={1} />
          ))}
          <Subtotal label="Total Operating Expenses" value={cur(data.labor + data.opex)} />

          <div className="border-t-2 border-gray-900 mt-4 pt-3">
            <Line label="NET PROFIT" value={cur(data.netProfit)} bold />
            <p className={`text-sm font-medium ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Net margin {fmtPct(data.netProfit, data.netSales)}
            </p>
          </div>

          <div className="border-t border-gray-100 mt-6 pt-4 grid grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-gray-400">Completed orders</p><p className="font-semibold">{data.orderCount}</p></div>
            <div><p className="text-xs text-gray-400">Average order value</p><p className="font-semibold">{cur(data.orderCount ? data.netSales / data.orderCount : 0)}</p></div>
            <div><p className="text-xs text-gray-400">Tax collected</p><p className="font-semibold">{cur(data.taxCollected)}</p></div>
          </div>
        </div>
      </Card>
    </div>
  )
}

const Section = ({ title }) => <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-1">{title}</p>
const Subtotal = ({ label, value, extra }) => (
  <div className="flex justify-between items-baseline border-t border-gray-200 mt-1 pt-1.5 bg-gray-50 px-2 -mx-2 rounded">
    <span className="font-semibold text-gray-900">{label}</span>
    <span className="text-right">
      <span className="font-semibold text-gray-900">{value}</span>
      {extra && <span className="block text-xs text-gray-400">{extra}</span>}
    </span>
  </div>
)
