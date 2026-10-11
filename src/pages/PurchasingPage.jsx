import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRMS, update, nextNumber, receivePurchaseOrder, logAudit, notify } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, useCurrency, toast } from '../components/ui'
import { Plus, Printer, CheckCircle } from 'lucide-react'

const PO_FLOW = ['draft', 'sent', 'approved', 'partially_received', 'received', 'paid']
const PO_COLORS = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', approved: 'bg-indigo-100 text-indigo-700', partially_received: 'bg-amber-100 text-amber-700', received: 'bg-emerald-100 text-emerald-700', paid: 'bg-teal-100 text-teal-700' }

export default function PurchasingPage() {
  const navigate = useNavigate()
  const s = useRMS()
  const cur = useCurrency()
  const [createOpen, setCreateOpen] = useState(false)
  const [view, setView] = useState(null)
  const [form, setForm] = useState({ supplier_id: '', branch_id: s.branches[0]?.id || '', items: [] })

  const suppliers = s.suppliers
  const pos = useMemo(() => [...s.purchase_orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [s.purchase_orders])
  const supOf = (po) => suppliers.find((x) => x.id === po.supplier_id)?.name || '—'
  const ingOf = (id) => s.ingredients.find((x) => x.id === id)

  const addItem = () => {
    if (!s.ingredients.length) { toast('Add an inventory item before creating a purchase order', 'error'); return }
    setForm((f) => ({ ...f, items: [...f.items, { ingredient_id: s.ingredients[0].id, qty: 1, price: s.ingredients[0].cost_per_unit || 0 }] }))
  }
  const total = form.items.reduce((sum, it) => sum + Number(it.qty) * Number(it.price), 0)

  const createPO = () => {
    if (!form.supplier_id || !form.items.length) { toast('Select a supplier and add items', 'error'); return }
    if (form.items.some((item) => !s.ingredients.some((ingredient) => ingredient.id === item.ingredient_id) || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0 || !Number.isFinite(Number(item.price)) || Number(item.price) < 0)) {
      toast('Each item needs a valid ingredient, positive quantity, and non-negative price', 'error')
      return
    }
    update((st) => {
      const po = {
        id: `po_${Math.random().toString(36).slice(2, 9)}`, number: nextNumber(st, 'po'),
        supplier_id: form.supplier_id, branch_id: form.branch_id || null, status: 'draft',
        items: form.items.map((it) => ({ ingredient_id: it.ingredient_id, qty: Number(it.qty), price: Number(it.price) })),
        tax: 0, discount: 0, total: Math.round(total * 100) / 100, payment_status: 'unpaid',
        created_at: new Date().toISOString(), received_at: null,
      }
      st.purchase_orders.push(po)
      logAudit(st, { user: 'Purchasing', action: 'create', entity: 'purchase_order', entity_id: po.number, new: cur(po.total) })
      notify(st, 'po', `Purchase order ${po.number} created (${cur(po.total)})`)
    })
    setCreateOpen(false)
    setForm({ supplier_id: '', branch_id: s.branches[0]?.id || '', items: [] })
    toast('Purchase order created as draft')
  }

  const advance = (po, action) => {
    const result = update((st) => {
      const x = st.purchase_orders.find((y) => y.id === po.id)
      if (!x) return { error: 'Purchase order no longer exists' }
      if (action === 'send') x.status = 'sent'
      if (action === 'approve') x.status = 'approved'
      if (action === 'pay') { x.payment_status = 'paid'; x.status = x.status === 'received' ? 'paid' : x.status }
      if (action === 'receive') {
        const receipt = receivePurchaseOrder(st, po.id, { user: 'Purchasing' })
        if (receipt.error) return receipt
      }
      logAudit(st, { user: 'Purchasing', action, entity: 'purchase_order', entity_id: po.number })
    })
    if (result?.error) { toast(result.error, 'error'); return }
    toast(`PO ${po.number} ${action === 'pay' ? 'marked paid' : action + 'ed'}`)
  }

  return (
    <div>
      <PageHeader title="Purchasing" subtitle="Purchase orders and goods receiving"
        actions={<Btn onClick={() => { setForm({ supplier_id: '', branch_id: s.branches[0]?.id || '', items: [] }); setCreateOpen(true) }}><Plus size={15} /> New Purchase Order</Btn>} />

      <div className="flex gap-1.5 flex-wrap mb-4">
        {PO_FLOW.map((st) => (
          <Badge key={st} color={PO_COLORS[st]}>{st.replace('_', ' ')}: {pos.filter((p) => p.status === st).length}</Badge>
        ))}
      </div>

      <Card pad={false}>
        <DataTable columns={[
          { key: 'number', label: 'PO #', render: (po) => <button className="text-emerald-700 font-medium hover:underline" onClick={() => setView(po)}>{po.number}</button> },
          { key: 'supplier', label: 'Supplier', render: (po) => supOf(po) },
          { key: 'created_at', label: 'Created', render: (po) => new Date(po.created_at).toLocaleDateString() },
          { key: 'items', label: 'Items', render: (po) => po.items.reduce((n, i) => n + i.qty, 0) },
          { key: 'total', label: 'Total', render: (po) => <span className="font-semibold">{cur(po.total)}</span> },
          { key: 'status', label: 'Status', render: (po) => <Badge color={PO_COLORS[po.status]}>{po.status.replace('_', ' ')}</Badge> },
          { key: 'payment_status', label: 'Payment', render: (po) => <Badge color={po.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{po.payment_status}</Badge> },
          {
            key: 'actions', label: '', render: (po) => (
              <div className="flex gap-1 flex-wrap">
                {po.status === 'draft' && <Btn size="sm" variant="secondary" onClick={() => advance(po, 'send')}>Send</Btn>}
                {po.status === 'sent' && <Btn size="sm" variant="secondary" onClick={() => advance(po, 'approve')}>Approve</Btn>}
                {['sent', 'approved'].includes(po.status) && <Btn size="sm" onClick={() => advance(po, 'receive')}><CheckCircle size={13} /> Receive</Btn>}
                {po.payment_status === 'unpaid' && ['received'].includes(po.status) && <Btn size="sm" variant="secondary" onClick={() => advance(po, 'pay')}>Pay</Btn>}
              </div>
            )
          },
        ]} rows={pos} empty="No purchase orders yet" />
      </Card>

      {/* PO detail */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Purchase Order ${view.number}` : ''} width="max-w-xl"
        footer={view && (
          <>
            <Btn variant="secondary" onClick={() => {
              const w = window.open('', '_blank')
              if (w) w.document.write(`<pre style="font-family:monospace">${view.number}\nSupplier: ${supOf(view)}\n${view.items.map((i) => `${i.qty} x ${ingOf(i.ingredient_id)?.name} @ ${cur(i.price)} = ${cur(i.qty * i.price)}`).join('\n')}\nTOTAL: ${cur(view.total)}</pre>`)
            }}><Printer size={13} /> Print</Btn>
            {['sent', 'approved'].includes(view.status) && <Btn onClick={() => { advance(view, 'receive'); setView(null) }}>Receive goods</Btn>}
          </>
        )}>
        {view && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge color={PO_COLORS[view.status]}>{view.status.replace('_', ' ')}</Badge>
              <Badge color={view.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{view.payment_status}</Badge>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2">Unit price</th><th className="py-2 text-right">Amount</th>
              </tr></thead>
              <tbody>
                {view.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{ingOf(it.ingredient_id)?.name || it.ingredient_id}</td>
                    <td className="py-2">{it.qty} {ingOf(it.ingredient_id)?.unit}</td>
                    <td className="py-2">{cur(it.price)}</td>
                    <td className="py-2 text-right">{cur(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-right font-bold text-gray-900">Total: {cur(view.total)}</p>
            {view.received_at && <p className="text-xs text-gray-500">Received on {new Date(view.received_at).toLocaleString()} — stock automatically increased.</p>}
          </div>
        )}
      </Modal>

      {/* Create PO */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New purchase order" width="max-w-2xl"
        footer={<><Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn><Btn onClick={createPO}>Create PO</Btn></>}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Supplier">
            <Select value={form.supplier_id} onChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
              options={[{ value: '', label: 'Choose supplier…' }, ...suppliers.map((x) => ({ value: x.id, label: x.name }))]} />
          </Field>
          <Field label="Deliver to branch">
            <Select value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))}
              options={[{ value: '', label: s.branches.length ? 'No branch' : 'No branches configured' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} />
          </Field>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
        {form.items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center mb-2">
            <Select className="flex-1" value={it.ingredient_id}
              onChange={(v) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ingredient_id: v, price: ingOf(v)?.cost_per_unit || x.price } : x)) }))}
              options={s.ingredients.map((x) => ({ value: x.id, label: `${x.name} (${x.unit})` }))} />
            <input type="number" step="0.01" className={`${inputCls} w-24`} value={it.qty}
              onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) }))} />
            <input type="number" step="0.01" className={`${inputCls} w-24`} value={it.price}
              onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) }))} />
            <span className="text-xs text-gray-500 w-16 text-right">{cur(Number(it.qty) * Number(it.price))}</span>
            <Btn size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}>×</Btn>
          </div>
        ))}
        {s.ingredients.length ? (
          <Btn size="sm" variant="secondary" onClick={addItem}><Plus size={13} /> Add item</Btn>
        ) : (
          <p className="text-sm text-gray-500">
            Add an inventory item first.{' '}
            <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={() => { setCreateOpen(false); navigate('/inventory') }}>Go to Inventory</button>
          </p>
        )}
        <p className="text-right font-bold text-gray-900 mt-3">Total: {cur(total)}</p>
      </Modal>
    </div>
  )
}
