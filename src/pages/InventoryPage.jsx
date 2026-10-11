import { useMemo, useState } from 'react'
import { useRMS, update, lowStockItems, logAudit, notify } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, SearchInput, useDebounce, useCurrency, toast, Tabs, Stat } from '../components/ui'
import { AlertTriangle, Plus, ArrowUpCircle, ArrowDownCircle, Package } from 'lucide-react'

const ITX_COLORS = { purchase: 'bg-emerald-100 text-emerald-700', sale: 'bg-blue-100 text-blue-700', waste: 'bg-red-100 text-red-700', damage: 'bg-red-100 text-red-700', adjustment: 'bg-amber-100 text-amber-700', transfer: 'bg-purple-100 text-purple-700', production: 'bg-indigo-100 text-indigo-700', return: 'bg-gray-100 text-gray-600' }

export default function InventoryPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [tab, setTab] = useState('items')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [adjOpen, setAdjOpen] = useState(false)
  const [adj, setAdj] = useState({ item_id: '', type: 'purchase', qty: '', reason: '' })
  const [countOpen, setCountOpen] = useState(false)
  const [counts, setCounts] = useState({})

  const items = useMemo(() => {
    let list = [...s.ingredients]
    if (dq) list = list.filter((i) => i.name.toLowerCase().includes(dq.toLowerCase()) || i.category.toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.ingredients, dq])

  const low = lowStockItems(s)
  const invValue = s.ingredients.reduce((sum, i) => sum + i.quantity * i.cost_per_unit, 0)

  const saveItem = (form) => {
    update((st) => {
      if (form.id) Object.assign(st.ingredients.find((x) => x.id === form.id), { ...form, quantity: Number(form.quantity), min_qty: Number(form.min_qty), max_qty: Number(form.max_qty), cost_per_unit: Number(form.cost_per_unit) })
      else st.ingredients.push({ ...form, id: `ing_${Math.random().toString(36).slice(2, 9)}`, quantity: Number(form.quantity), min_qty: Number(form.min_qty), max_qty: Number(form.max_qty), cost_per_unit: Number(form.cost_per_unit) })
      logAudit(st, { user: 'Inventory Manager', action: form.id ? 'update' : 'create', entity: 'inventory_item', entity_id: form.name })
    })
    setEditOpen(false)
    toast('Item saved')
  }

  const submitAdjustment = () => {
    if (!adj.item_id || !adj.qty) { toast('Select item and quantity', 'error'); return }
    update((st) => {
      const ing = st.ingredients.find((x) => x.id === adj.item_id)
      const qty = adj.type === 'sale' || adj.type === 'waste' || adj.type === 'damage' ? -Math.abs(Number(adj.qty)) : Math.abs(Number(adj.qty))
      ing.quantity = Math.max(0, Math.round((ing.quantity + qty) * 100) / 100)
      st.inventory_transactions.unshift({
        id: `itx_${Math.random().toString(36).slice(2, 9)}`, ingredient_id: ing.id, type: adj.type,
        qty, cost: Math.round(Math.abs(qty) * ing.cost_per_unit * 100) / 100, reason: adj.reason || adj.type,
        ref: `ADJ-${Date.now().toString().slice(-5)}`, user: 'Inventory Manager', created_at: new Date().toISOString(),
      })
      logAudit(st, { user: 'Inventory Manager', action: 'adjust', entity: 'inventory', entity_id: ing.name, prev: `${ing.quantity - qty} ${ing.unit}`, new: `${ing.quantity} ${ing.unit}` })
      if (ing.quantity <= ing.min_qty) notify(st, 'low_stock', `Low stock: ${ing.name} (${ing.quantity} ${ing.unit})`)
    })
    setAdjOpen(false)
    setAdj({ item_id: '', type: 'purchase', qty: '', reason: '' })
    toast('Transaction recorded')
  }

  const startCount = () => {
    const init = {}
    s.ingredients.forEach((i) => { init[i.id] = i.quantity })
    setCounts(init)
    setCountOpen(true)
  }

  const submitCount = () => {
    update((st) => {
      const items2 = st.ingredients.map((i) => {
        const actual = counts[i.id] === '' || counts[i.id] === undefined ? i.quantity : Number(counts[i.id])
        const variance = Math.round((actual - i.quantity) * 100) / 100
        return { item_id: i.id, name: i.name, unit: i.unit, theoretical: i.quantity, actual, variance, variance_cost: Math.round(variance * i.cost_per_unit * 100) / 100 }
      })
      const varianceCost = items2.reduce((sum, x) => sum + Math.abs(x.variance_cost), 0)
      st.stock_counts.unshift({
        id: `sc_${Math.random().toString(36).slice(2, 9)}`, date: new Date().toISOString(),
        items: items2.filter((x) => x.variance !== 0), status: 'approved', variance_cost: varianceCost, user: 'Inventory Manager',
      })
      items2.forEach((x) => {
        if (x.variance !== 0) {
          const ing = st.ingredients.find((i) => i.id === x.item_id)
          ing.quantity = x.actual
          st.inventory_transactions.unshift({ id: `itx_${Math.random().toString(36).slice(2, 9)}`, ingredient_id: x.item_id, type: 'adjustment', qty: x.variance, cost: x.variance_cost, reason: 'Stock count', ref: 'STOCKCOUNT', user: 'Inventory Manager', created_at: new Date().toISOString() })
        }
      })
      logAudit(st, { user: 'Inventory Manager', action: 'stocktake', entity: 'stock_count', entity_id: `variance ${cur(varianceCost)}` })
    })
    setCountOpen(false)
    toast('Stock count approved and inventory adjusted')
  }

  const supOf = (i) => s.suppliers.find((x) => x.id === i.supplier_id)?.name || '—'

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Ingredients, stock levels and movements"
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search items…" className="w-52" />
          <Btn variant="secondary" onClick={() => { setAdj({ item_id: '', type: 'purchase', qty: '', reason: '' }); setAdjOpen(true) }}><Plus size={15} /> Transaction</Btn>
          <Btn variant="secondary" onClick={startCount}><Package size={15} /> Stock Count</Btn>
          <Btn onClick={() => { setEditItem(null); setEditOpen(true) }}><Plus size={15} /> Item</Btn>
        </>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'items', label: 'Items' },
        { key: 'transactions', label: 'Transactions' },
        { key: 'lowstock', label: `Low Stock (${low.length})` },
        { key: 'stocktakes', label: 'Stocktakes' },
      ]} />

      {tab === 'items' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Total items" value={s.ingredients.length} />
            <Stat label="Inventory value" value={cur(invValue)} tone="green" />
            <Stat label="Low stock" value={low.length} tone={low.length ? 'orange' : 'gray'} />
            <Stat label="Out of stock" value={s.ingredients.filter((i) => i.quantity <= 0).length} tone={s.ingredients.some((i) => i.quantity <= 0) ? 'red' : 'gray'} />
          </div>
          <Card pad={false}>
            <DataTable columns={[
              { key: 'name', label: 'Item', render: (i) => <span className="font-medium text-gray-800">{i.name}</span> },
              { key: 'category', label: 'Category' },
              { key: 'location', label: 'Location' },
              {
                key: 'quantity', label: 'On hand', render: (i) => {
                  const pct = i.max_qty ? i.quantity / i.max_qty : 0
                  return (
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold">{i.quantity} {i.unit}</span>
                        <span className="text-gray-400">min {i.min_qty}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i.quantity <= i.min_qty ? 'bg-red-500' : pct > 0.85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                      </div>
                    </div>
                  )
                }
              },
              { key: 'cost_per_unit', label: 'Unit cost', render: (i) => cur(i.cost_per_unit) },
              { key: 'value', label: 'Value', render: (i) => <span className="font-semibold">{cur(i.quantity * i.cost_per_unit)}</span> },
              { key: 'supplier_id', label: 'Supplier', render: (i) => supOf(i) },
              { key: 'actions', label: '', render: (i) => <Btn size="sm" variant="ghost" onClick={() => { setEditItem(i); setEditOpen(true) }}>Edit</Btn> },
            ]} rows={items} />
          </Card>
        </>
      )}

      {tab === 'transactions' && (
        <Card pad={false}>
          <DataTable columns={[
            { key: 'created_at', label: 'Date', render: (t) => new Date(t.created_at).toLocaleString() },
            { key: 'ingredient', label: 'Item', render: (t) => s.ingredients.find((i) => i.id === t.ingredient_id)?.name || t.ingredient_id },
            { key: 'type', label: 'Type', render: (t) => <Badge color={ITX_COLORS[t.type]}>{t.type}</Badge> },
            { key: 'qty', label: 'Qty', render: (t) => <span className={t.qty >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{t.qty > 0 ? '+' : ''}{t.qty}</span> },
            { key: 'cost', label: 'Cost impact', render: (t) => (t.cost ? cur(t.cost) : '—') },
            { key: 'reason', label: 'Reason' },
            { key: 'ref', label: 'Reference' },
            { key: 'user', label: 'By' },
          ]} rows={s.inventory_transactions.slice(0, 100)} empty="No transactions yet" />
        </Card>
      )}

      {tab === 'lowstock' && (
        <Card>
          {low.length ? (
            <div className="space-y-2 p-2">
              {low.map((i) => (
                <div key={i.id} className="flex items-center justify-between border border-amber-200 bg-amber-50/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{i.name}</p>
                      <p className="text-xs text-gray-500">{i.quantity} {i.unit} on hand · reorder at {i.min_qty} {i.unit} · supplier: {supOf(i)}</p>
                    </div>
                  </div>
                  <Btn size="sm" onClick={() => { setAdj({ item_id: i.id, type: 'purchase', qty: String(i.min_qty * 2), reason: 'Restock' }); setAdjOpen(true) }}>Reorder</Btn>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">All items are above their reorder levels 🎉</p>}
        </Card>
      )}

      {tab === 'stocktakes' && (
        <Card pad={false}>
          <DataTable columns={[
            { key: 'date', label: 'Date', render: (c) => new Date(c.date).toLocaleString() },
            { key: 'items', label: 'Variances', render: (c) => c.items.length },
            { key: 'variance_cost', label: 'Variance cost', render: (c) => <span className={`font-semibold ${c.variance_cost > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{cur(c.variance_cost)}</span> },
            { key: 'status', label: 'Status', render: (c) => <Badge color="bg-emerald-100 text-emerald-700">{c.status}</Badge> },
            { key: 'user', label: 'Counted by' },
          ]} rows={s.stock_counts} empty="No stocktakes yet — use the Stock Count button" />
        </Card>
      )}

      {/* Item editor */}
      <ItemModal open={editOpen} onClose={() => setEditOpen(false)} item={editItem} onSave={saveItem} suppliers={s.suppliers} />

      {/* Transaction modal */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title="Record inventory transaction"
        footer={<><Btn variant="secondary" onClick={() => setAdjOpen(false)}>Cancel</Btn><Btn onClick={submitAdjustment}>Record</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item">
            <Select value={adj.item_id} onChange={(v) => setAdj((a) => ({ ...a, item_id: v }))}
              options={[{ value: '', label: 'Choose…' }, ...s.ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit})` }))]} />
          </Field>
          <Field label="Type">
            <Select value={adj.type} onChange={(v) => setAdj((a) => ({ ...a, type: v }))}
              options={['purchase', 'waste', 'damage', 'adjustment', 'transfer', 'production', 'return'].map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="Quantity">
            <input type="number" step="0.01" className={inputCls} value={adj.qty} onChange={(e) => setAdj((a) => ({ ...a, qty: e.target.value }))} />
          </Field>
          <Field label="Reason / notes">
            <input className={inputCls} value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} />
          </Field>
        </div>
        <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
          {['waste', 'damage', 'sale'].includes(adj.type) ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
          {['waste', 'damage', 'sale'].includes(adj.type) ? 'This removes stock.' : 'This adds stock.'} Every transaction records user, timestamp and reference automatically.
        </p>
      </Modal>

      {/* Stock count modal */}
      <Modal open={countOpen} onClose={() => setCountOpen(false)} title="Stock count — enter actual quantities" width="max-w-2xl"
        footer={<><Btn variant="secondary" onClick={() => setCountOpen(false)}>Cancel</Btn><Btn onClick={submitCount}>Approve & adjust</Btn></>}>
        <div className="space-y-1.5 max-h-[24rem] overflow-y-auto pr-1">
          {s.ingredients.map((i) => {
            const actual = counts[i.id]
            const variance = actual === '' || actual === undefined ? 0 : Number(actual) - i.quantity
            return (
              <div key={i.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-gray-700">{i.name} <span className="text-xs text-gray-400">(system: {i.quantity} {i.unit})</span></span>
                <input type="number" step="0.01" className={`${inputCls} w-28`} value={counts[i.id] ?? ''}
                  placeholder={String(i.quantity)}
                  onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))} />
                <span className={`text-xs w-20 text-right font-medium ${variance === 0 ? 'text-gray-400' : variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {variance === 0 ? '—' : `${variance > 0 ? '+' : ''}${variance}`}
                </span>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}

function ItemModal({ open, onClose, item, onSave, suppliers }) {
  const blank = { id: null, name: '', unit: 'kg', category: 'Dry Store', location: '', quantity: 0, min_qty: 1, max_qty: 10, cost_per_unit: 1, supplier_id: suppliers[0]?.id || '' }
  const [form, setForm] = useState(blank)
  useMemo(() => { if (open) setForm(item ? { ...item } : blank) /* eslint-disable-next-line */ }, [open])
  return (
    <Modal open={open} onClose={onClose} title={form.id ? `Edit ${form.name}` : 'New inventory item'}
      footer={<><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={() => onSave(form)}>Save item</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Unit"><Select value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} options={['kg', 'g', 'L', 'ml', 'pc', 'box'].map((u) => ({ value: u, label: u }))} /></Field>
        <Field label="Category"><input className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field>
        <Field label="Storage location"><input className={inputCls} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></Field>
        <Field label="Current quantity"><input type="number" step="0.01" className={inputCls} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></Field>
        <Field label="Min (reorder level)"><input type="number" step="0.01" className={inputCls} value={form.min_qty} onChange={(e) => setForm((f) => ({ ...f, min_qty: e.target.value }))} /></Field>
        <Field label="Max"><input type="number" step="0.01" className={inputCls} value={form.max_qty} onChange={(e) => setForm((f) => ({ ...f, max_qty: e.target.value }))} /></Field>
        <Field label="Cost per unit"><input type="number" step="0.01" className={inputCls} value={form.cost_per_unit} onChange={(e) => setForm((f) => ({ ...f, cost_per_unit: e.target.value }))} /></Field>
        <Field label="Default supplier">
          <Select value={form.supplier_id} onChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
            options={[{ value: '', label: 'None' }, ...suppliers.map((x) => ({ value: x.id, label: x.name }))]} />
        </Field>
      </div>
    </Modal>
  )
}
