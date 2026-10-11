import { useState } from 'react'
import { useRMS, update, completeOrder, ORDER_TYPE_LABELS, logAudit } from '../lib/rmsData'
import { PageHeader, Badge, Btn, useCurrency, toast } from '../components/ui'
import { Clock, Flame, CheckCircle, Printer } from 'lucide-react'

const KITCHEN_FLOW = ['new', 'accepted', 'preparing', 'ready', 'served']
const STATIONS = ['All', 'Grill', 'Fryer', 'Pizza', 'Drinks', 'Dessert', 'Main Kitchen']

export default function KitchenPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [station, setStation] = useState('All')
  const [onlyActive, setOnlyActive] = useState(true)

  const activeOrders = s.orders
    .filter((o) => !['completed', 'cancelled', 'refunded', 'held'].includes(o.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const visible = activeOrders.filter((o) => {
    if (onlyActive && ['served'].includes(o.status)) return false
    if (station === 'All') return true
    return o.items.some((it) => s.products.find((p) => p.id === it.product_id)?.station === station)
  })

  const advance = (o) => {
    const idx = KITCHEN_FLOW.indexOf(o.status)
    if (idx < 0 || idx >= KITCHEN_FLOW.length - 1) return
    const next = KITCHEN_FLOW[idx + 1]
    update((st) => {
      const ord = st.orders.find((x) => x.id === o.id)
      ord.status = next
      logAudit(st, { user: 'Kitchen', action: 'update', entity: 'order', entity_id: o.number, prev: o.status, new: next })
      if (next === 'served' && ord.payment_status === 'paid') completeOrder(st, ord, { user: 'Kitchen' })
    })
    if (next === 'served') toast(`${o.number} served & completed`)
  }

  const elapsed = (o) => Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000)
  const elapsedColor = (mins) => (mins > 30 ? 'text-red-600' : mins > 18 ? 'text-amber-600' : 'text-gray-500')

  const col = (status) => visible.filter((o) => o.status === status)

  return (
    <div>
      <PageHeader title="Kitchen Display System" subtitle="Live order board for the kitchen"
        actions={<>
          <div className="flex gap-1 flex-wrap">
            {STATIONS.map((st) => (
              <Btn key={st} size="sm" variant={station === st ? 'primary' : 'secondary'} onClick={() => setStation(st)}>{st}</Btn>
            ))}
          </div>
          <Btn size="sm" variant={onlyActive ? 'primary' : 'secondary'} onClick={() => setOnlyActive(!onlyActive)}>
            {onlyActive ? 'Active only' : 'Show served'}
          </Btn>
        </>} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KITCHEN_FLOW.slice(0, 4).map((status) => (
          <div key={status} className="bg-gray-100/70 rounded-xl p-3 min-h-[16rem]">
            <div className="flex items-center justify-between px-1 mb-3">
              <p className="font-semibold text-sm text-gray-700 capitalize">{status}</p>
              <Badge color={status === 'new' ? 'bg-blue-100 text-blue-700' : status === 'accepted' ? 'bg-indigo-100 text-indigo-700' : status === 'preparing' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}>
                {col(status).length}
              </Badge>
            </div>
            <div className="space-y-2.5">
              {col(status).map((o) => {
                const mins = elapsed(o)
                const table = s.tables.find((t) => t.id === o.table_id)
                return (
                  <div key={o.id} className={`bg-white rounded-lg border p-3 shadow-sm ${mins > 30 ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-gray-900">{o.number}</span>
                      <span className={`text-xs flex items-center gap-1 font-medium ${elapsedColor(mins)}`}>
                        <Clock size={12} /> {mins}m
                      </span>
                    </div>
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      <Badge color="bg-gray-100 text-gray-600">{ORDER_TYPE_LABELS[o.type]}</Badge>
                      {table && <Badge color="bg-blue-50 text-blue-700">Table {table.number}</Badge>}
                      {mins > 30 && <Badge color="bg-red-100 text-red-700">Overdue</Badge>}
                    </div>
                    <ul className="text-sm space-y-1">
                      {o.items.map((it, i) => {
                        const p = s.products.find((x) => x.id === it.product_id)
                        return (
                          <li key={i} className="text-gray-700">
                            <span className="font-semibold">{it.qty}×</span> {it.name}
                            {p && <span className="text-[10px] text-gray-400 ml-1">({p.station})</span>}
                            {it.modifiers?.length > 0 && <span className="block text-xs text-gray-500">+ {it.modifiers.map((m) => m.name).join(', ')}</span>}
                            {it.notes && <span className="block text-xs text-amber-600">⚠ {it.notes}</span>}
                          </li>
                        )
                      })}
                    </ul>
                    {o.notes && <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 rounded px-1.5 py-1">{o.notes}</p>}
                    <div className="flex gap-1.5 mt-2.5">
                      <Btn size="sm" className="flex-1" onClick={() => advance(o)}>
                        {status === 'new' ? 'Accept' : status === 'accepted' ? <><Flame size={12} /> Start</> : status === 'preparing' ? <><CheckCircle size={12} /> Ready</> : 'Serve'}
                      </Btn>
                      <Btn size="sm" variant="ghost" title="Print kitchen ticket" onClick={() => {
                        const w = window.open('', '_blank')
                        if (w) w.document.write(`<pre style="font-family:monospace">${o.number} — ${ORDER_TYPE_LABELS[o.type]}${table ? ` Table ${table.number}` : ''}\n${o.items.map((i) => `${i.qty}x ${i.name}${i.notes ? '  *' + i.notes : ''}`).join('\n')}</pre>`)
                      }}><Printer size={13} /></Btn>
                    </div>
                  </div>
                )
              })}
              {!col(status).length && <p className="text-xs text-gray-400 text-center py-6">No orders</p>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-4">Tickets older than 30 minutes are highlighted red. Totals are hidden on the kitchen view.</p>
    </div>
  )
}
