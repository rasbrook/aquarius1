import { useMemo, useState } from 'react'
import { useRMS, ORDER_TYPE_LABELS } from '../lib/rmsData'
import { PageHeader, Card, Btn, DataTable, Select, useCurrency, Badge } from '../components/ui'
import { Download } from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns'

function csvDownload(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SalesReportsPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [range, setRange] = useState('30')

  const from = useMemo(() => {
    const now = new Date()
    if (range === '7') return subDays(now, 7)
    if (range === '30') return subDays(now, 30)
    if (range === 'month') return startOfMonth(now)
    return subDays(now, 365)
  }, [range])

  const orders = useMemo(() => s.orders.filter((o) => o.status === 'completed' && new Date(o.created_at) >= from), [s.orders, from])

  const byProduct = useMemo(() => {
    const m = {}
    orders.forEach((o) => o.items.forEach((it) => {
      if (!m[it.product_id]) m[it.product_id] = { name: it.name, qty: 0, revenue: 0 }
      m[it.product_id].qty += it.qty
      m[it.product_id].revenue += (it.price + (it.modifiers || []).reduce((a, x) => a + x.price, 0)) * it.qty
    }))
    return Object.values(m).sort((a, b) => b.revenue - a.revenue)
  }, [orders])

  const byCategory = useMemo(() => {
    const m = {}
    orders.forEach((o) => o.items.forEach((it) => {
      const p = s.products.find((x) => x.id === it.product_id)
      const cat = s.categories.find((c) => c.id === p?.category_id)?.name || 'Other'
      m[cat] = (m[cat] || 0) + (it.price + (it.modifiers || []).reduce((a, x) => a + x.price, 0)) * it.qty
    }))
    return Object.entries(m).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue)
  }, [orders, s.products, s.categories])

  const byWaiter = useMemo(() => {
    const m = {}
    orders.forEach((o) => { const k = o.waiter_id || 'none'; m[k] = (m[k] || 0) + o.total })
    return Object.entries(m).map(([id, revenue]) => ({ name: s.employees.find((e) => e.id === id)?.name || 'Unassigned', revenue })).sort((a, b) => b.revenue - a.revenue)
  }, [orders, s.employees])

  const byMethod = useMemo(() => {
    const m = {}
    orders.forEach((o) => o.payments.forEach((p) => { m[p.method] = (m[p.method] || 0) + p.amount }))
    return Object.entries(m).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  }, [orders])

  const byType = useMemo(() => {
    const m = {}
    orders.forEach((o) => { m[o.type] = (m[o.type] || 0) + o.total })
    return Object.entries(m).map(([type, revenue]) => ({ name: ORDER_TYPE_LABELS[type], revenue })).sort((a, b) => b.revenue - a.revenue)
  }, [orders])

  const byDay = useMemo(() => {
    const m = {}
    orders.forEach((o) => { const d = format(new Date(o.created_at), 'yyyy-MM-dd'); m[d] = (m[d] || 0) + o.total })
    return Object.entries(m).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date))
  }, [orders])

  const exportOrders = () => csvDownload('orders-report.csv', [
    ['Order #', 'Date', 'Type', 'Table', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment', 'Status'],
    ...orders.map((o) => [
      o.number, format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'), o.type,
      s.tables.find((t) => t.id === o.table_id)?.number || '',
      s.customers.find((c) => c.id === o.customer_id)?.name || 'Walk-in',
      o.items.reduce((n, i) => n + i.qty, 0), o.subtotal, o.discount, o.tax, o.total,
      o.payments.map((p) => p.method).join('+'), o.status,
    ]),
  ])

  const today = new Date()
  const todayOrders = orders.filter((o) => isSameDay(new Date(o.created_at), today))
  const monthOrders = orders.filter((o) => { const d = new Date(o.created_at); return d >= startOfMonth(today) && d <= endOfMonth(today) })

  return (
    <div>
      <PageHeader title="Sales Reports" subtitle="Detailed sales breakdowns with CSV export"
        actions={<>
          <Select value={range} onChange={setRange}
            options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: 'month', label: 'This month' }, { value: '365', label: 'Last 12 months' }]} />
          <Btn variant="secondary" onClick={exportOrders}><Download size={15} /> Export CSV</Btn>
        </>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-500">Today</p><p className="text-lg font-bold text-gray-900">{cur(todayOrders.reduce((sum, o) => sum + o.total, 0))}</p><p className="text-xs text-gray-400">{todayOrders.length} orders</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-500">This month</p><p className="text-lg font-bold text-gray-900">{cur(monthOrders.reduce((sum, o) => sum + o.total, 0))}</p><p className="text-xs text-gray-400">{monthOrders.length} orders</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-500">Selected period</p><p className="text-lg font-bold text-gray-900">{cur(orders.reduce((sum, o) => sum + o.total, 0))}</p><p className="text-xs text-gray-400">{orders.length} orders</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-500">Avg order value</p><p className="text-lg font-bold text-gray-900">{cur(orders.length ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0)}</p><p className="text-xs text-gray-400">selected period</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Sales by product">
          <div className="overflow-x-auto">
            <DataTable columns={[
              { key: 'name', label: 'Product' },
              { key: 'qty', label: 'Qty sold' },
              { key: 'revenue', label: 'Revenue', render: (r) => <span className="font-semibold">{cur(r.revenue)}</span> },
            ]} rows={byProduct.slice(0, 15)} empty="No data" />
          </div>
        </Card>
        <Card title="Sales by category">
          <DataTable columns={[
            { key: 'name', label: 'Category' },
            { key: 'revenue', label: 'Revenue', render: (r) => <span className="font-semibold">{cur(r.revenue)}</span> },
            { key: 'pct', label: '% of sales', render: (r) => { const t = byCategory.reduce((sum, x) => sum + x.revenue, 0); return `${t ? ((r.revenue / t) * 100).toFixed(1) : 0}%` } },
          ]} rows={byCategory} empty="No data" />
        </Card>
        <Card title="Sales by employee / waiter">
          <DataTable columns={[
            { key: 'name', label: 'Employee' },
            { key: 'revenue', label: 'Revenue', render: (r) => <span className="font-semibold">{cur(r.revenue)}</span> },
          ]} rows={byWaiter} empty="No data" />
        </Card>
        <Card title="Sales by payment method & order type">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment methods</p>
              {byMethod.map((m) => (
                <div key={m.name} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-700">{m.name}</span><span className="font-medium">{cur(m.amount)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Order types</p>
              {byType.map((t) => (
                <div key={t.name} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                  <span className="text-gray-700">{t.name}</span><span className="font-medium">{cur(t.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Daily sales (selected period)" className="lg:col-span-2">
          <DataTable columns={[
            { key: 'date', label: 'Date', render: (r) => format(new Date(r.date), 'EEE, MMM d yyyy') },
            { key: 'revenue', label: 'Revenue', render: (r) => <span className="font-semibold">{cur(r.revenue)}</span> },
            { key: 'orders', label: 'Orders', render: (r) => orders.filter((o) => format(new Date(o.created_at), 'yyyy-MM-dd') === r.date).length },
          ]} rows={[...byDay].reverse().slice(0, 20)} empty="No data" />
        </Card>
      </div>
    </div>
  )
}
