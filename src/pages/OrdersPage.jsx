import { useMemo, useState } from 'react'
import {
  useRMS, update, cancelOrder, completeOrder, ORDER_STATUSES, ORDER_STATUS_COLORS,
  PAYMENT_STATUS_COLORS, ORDER_TYPE_LABELS, logAudit, notify,
} from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, DataTable, SearchInput, useDebounce, Select, useCurrency, toast } from '../components/ui'
import { Eye, XCircle, CheckCircle, Printer } from 'lucide-react'

export default function OrdersPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [refundOpen, setRefundOpen] = useState(false)

  const rows = useMemo(() => {
    let list = [...s.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (status !== 'all') list = list.filter((o) => o.status === status)
    if (dq) list = list.filter((o) => o.number.toLowerCase().includes(dq.toLowerCase()) ||
      (o.items || []).some((i) => i.name.toLowerCase().includes(dq.toLowerCase())) ||
      (s.customers.find((c) => c.id === o.customer_id)?.name || '').toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.orders, s.customers, status, dq])

  const tableOf = (o) => s.tables.find((t) => t.id === o.table_id)
  const custOf = (o) => s.customers.find((c) => c.id === o.customer_id)
  const waiterOf = (o) => s.employees.find((e) => e.id === o.waiter_id)

  const refundOrder = () => {
    update((st) => {
      const o = st.orders.find((x) => x.id === selected.id)
      if (!o) return
      o.status = 'refunded'
      o.payment_status = 'refunded'
      logAudit(st, { user: 'Manager', action: 'refund', entity: 'order', entity_id: o.number, prev: cur(o.total), new: cur(-o.total) })
      notify(st, 'order', `Order ${o.number} was refunded`)
    })
    setRefundOpen(false)
    setSelected(null)
    toast('Order refunded (financial reversal recorded)')
  }

  const advanceStatus = (o) => {
    const flow = ['new', 'accepted', 'preparing', 'ready', 'served']
    const idx = flow.indexOf(o.status)
    if (idx < 0 || idx === flow.length - 1) return
    update((st) => {
      const ord = st.orders.find((x) => x.id === o.id)
      ord.status = flow[idx + 1]
      if (flow[idx + 1] === 'served') { ord.status = 'served' }
    })
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${s.orders.length} orders on record`}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Search order #, item, customer…" className="w-64" />} />

      <div className="flex gap-1.5 flex-wrap mb-4">
        {['all', ...ORDER_STATUSES].map((st) => (
          <Btn key={st} size="sm" variant={status === st ? 'primary' : 'secondary'} onClick={() => setStatus(st)} className="capitalize">
            {st === 'all' ? `All (${s.orders.length})` : `${st} (${s.orders.filter((o) => o.status === st).length})`}
          </Btn>
        ))}
      </div>

      <Card pad={false}>
        <DataTable
          columns={[
            { key: 'number', label: 'Order #', render: (o) => <button className="text-emerald-700 font-medium hover:underline" onClick={() => setSelected(o)}>{o.number}</button> },
            { key: 'created_at', label: 'Date / Time', render: (o) => <span className="text-gray-600">{new Date(o.created_at).toLocaleDateString()} {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> },
            { key: 'type', label: 'Type', render: (o) => ORDER_TYPE_LABELS[o.type] },
            { key: 'table', label: 'Table', render: (o) => tableOf(o) ? `T${tableOf(o).number}` : '—' },
            { key: 'customer', label: 'Customer', render: (o) => custOf(o)?.name || <span className="text-gray-400">Walk-in</span> },
            { key: 'waiter', label: 'Waiter', render: (o) => waiterOf(o)?.name || '—' },
            { key: 'items', label: 'Items', render: (o) => o.items.reduce((n, i) => n + i.qty, 0) },
            { key: 'total', label: 'Total', render: (o) => <span className="font-semibold">{cur(o.total)}</span> },
            { key: 'status', label: 'Status', render: (o) => <Badge color={ORDER_STATUS_COLORS[o.status]}>{o.status}</Badge> },
            { key: 'payment_status', label: 'Payment', render: (o) => <Badge color={PAYMENT_STATUS_COLORS[o.payment_status]}>{o.payment_status}</Badge> },
            {
              key: 'actions', label: '', render: (o) => (
                <div className="flex gap-1">
                  <Btn size="sm" variant="ghost" onClick={() => setSelected(o)} title="View"><Eye size={14} /></Btn>
                  {!['completed', 'cancelled', 'refunded', 'held'].includes(o.status) && (
                    <Btn size="sm" variant="ghost" title="Advance status" onClick={() => advanceStatus(o)}><CheckCircle size={14} className="text-emerald-600" /></Btn>
                  )}
                  {!['completed', 'cancelled', 'refunded'].includes(o.status) && (
                    <Btn size="sm" variant="ghost" title="Cancel order" onClick={() => { update((st) => cancelOrder(st, o.id, { user: 'Manager' })); toast('Order cancelled') }}><XCircle size={14} className="text-red-500" /></Btn>
                  )}
                </div>
              )
            },
          ]}
          rows={rows}
          empty="No orders match the current filters"
        />
      </Card>

      {/* Order detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Order ${selected.number}` : ''} width="max-w-2xl"
        footer={selected && (
          <>
            {selected.status === 'completed' && selected.payment_status === 'paid' && (
              <Btn variant="danger" onClick={() => setRefundOpen(true)}>Refund</Btn>
            )}
            {['new', 'accepted', 'preparing', 'ready'].includes(selected.status) && (
              <Btn onClick={() => { advanceStatus(selected); setSelected(null) }}>Advance to next status</Btn>
            )}
          </>
        )}>
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge color={ORDER_STATUS_COLORS[selected.status]}>{selected.status}</Badge>
              <Badge color={PAYMENT_STATUS_COLORS[selected.payment_status]}>{selected.payment_status}</Badge>
              <Badge>{ORDER_TYPE_LABELS[selected.type]}</Badge>
              {tableOf(selected) && <Badge color="bg-blue-50 text-blue-700">Table {tableOf(selected).number}</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Meta label="Customer" value={custOf(selected)?.name || 'Walk-in'} />
              <Meta label="Waiter" value={waiterOf(selected)?.name || '—'} />
              <Meta label="Created" value={new Date(selected.created_at).toLocaleString()} />
              <Meta label="Completed" value={selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '—'} />
            </div>
            {selected.notes && <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-800">Note: {selected.notes}</p>}
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2 text-right">Amount</th>
              </tr></thead>
              <tbody>
                {selected.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">
                      <p className="text-gray-800">{it.name}</p>
                      {it.modifiers?.length > 0 && <p className="text-xs text-gray-500">+ {it.modifiers.map((m) => m.name).join(', ')}</p>}
                      {it.notes && <p className="text-xs text-amber-600">Note: {it.notes}</p>}
                    </td>
                    <td className="py-2">{it.qty}</td>
                    <td className="py-2 text-right">{cur((it.price + (it.modifiers || []).reduce((a, m) => a + (m.price || 0), 0)) * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 text-sm ml-auto w-64">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{cur(selected.subtotal)}</span></div>
              {selected.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount{selected.discount_code ? ` (${selected.discount_code})` : ''}</span><span>−{cur(selected.discount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Tax ({selected.tax_rate}%)</span><span>{cur(selected.tax)}</span></div>
              {selected.tip > 0 && <div className="flex justify-between text-gray-600"><span>Tip</span><span>{cur(selected.tip)}</span></div>}
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 pt-1"><span>Total</span><span>{cur(selected.total)}</span></div>
            </div>
            {selected.payments?.length > 0 && (
              <div className="text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Payments</p>
                {selected.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-gray-600"><span>{p.method} <span className="text-xs text-gray-400">({p.reference})</span></span><span>{cur(p.amount)}</span></div>
                ))}
              </div>
            )}
            <Btn variant="secondary" size="sm" onClick={() => {
              const w = window.open('', '_blank')
              if (w) w.document.write(`<pre style="font-family:monospace;font-size:12px">${selected.number}\n${selected.items.map((i) => `${i.qty}x ${i.name}`).join('\n')}\nTotal: ${cur(selected.total)}</pre>`)
            }}><Printer size={13} /> Print order</Btn>
          </div>
        )}
      </Modal>

      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Confirm refund" width="max-w-sm"
        footer={<>
          <Btn variant="secondary" onClick={() => setRefundOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={refundOrder}>Refund {selected ? cur(selected.total) : ''}</Btn>
        </>}>
        <p className="text-sm text-gray-600">This records a financial reversal for {selected?.number}. The original order stays in history as refunded — it is never deleted.</p>
      </Modal>
    </div>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-gray-800 font-medium">{value}</p>
    </div>
  )
}
