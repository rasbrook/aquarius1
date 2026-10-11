import { useMemo, useState } from 'react'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, DataTable, useCurrency, toast } from '../components/ui'
import { Plus } from 'lucide-react'

export default function SuppliersPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [view, setView] = useState(null)

  const openEdit = (sup) => { setForm(sup ? { ...sup } : { id: null, name: '', contact: '', phone: '', email: '', address: '', tax_id: '', terms: 'Net 14', balance: 0 }); setEditOpen(true) }

  const save = () => {
    if (!form.name) { toast('Name required', 'error'); return }
    update((st) => {
      if (form.id) Object.assign(st.suppliers.find((x) => x.id === form.id), form)
      else st.suppliers.push({ ...form, id: `sup_${Math.random().toString(36).slice(2, 9)}` })
      logAudit(st, { user: 'Manager', action: form.id ? 'update' : 'create', entity: 'supplier', entity_id: form.name })
    })
    setEditOpen(false)
    toast('Supplier saved')
  }

  const posOf = (sup) => s.purchase_orders.filter((p) => p.supplier_id === sup.id)
  const itemsSupplied = (sup) => s.ingredients.filter((i) => i.supplier_id === sup.id)

  return (
    <div>
      <PageHeader title="Suppliers" subtitle={`${s.suppliers.length} vendors`}
        actions={<Btn onClick={() => openEdit(null)}><Plus size={15} /> New Supplier</Btn>} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {s.suppliers.map((sup) => (
          <button key={sup.id} onClick={() => setView(sup)} className="text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-emerald-400 transition-colors">
            <div className="flex items-start justify-between">
              <p className="font-semibold text-gray-900">{sup.name}</p>
              <Badge color={sup.balance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>{sup.balance > 0 ? `owes ${cur(sup.balance)}` : 'settled'}</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">{sup.contact} · {sup.phone}</p>
            <p className="text-xs text-gray-400">{sup.email}</p>
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              <span>{itemsSupplied(sup).length} items supplied</span>
              <span>{posOf(sup).length} purchase orders</span>
              <span>Terms: {sup.terms}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.name} width="max-w-xl"
        footer={view && <Btn onClick={() => { openEdit(view); setView(null) }}>Edit supplier</Btn>}>
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Contact" value={view.contact} />
              <Meta label="Phone" value={view.phone} />
              <Meta label="Email" value={view.email} />
              <Meta label="Tax ID" value={view.tax_id} />
              <Meta label="Address" value={view.address} />
              <Meta label="Payment terms" value={view.terms} />
              <Meta label="Outstanding balance" value={cur(view.balance)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Items supplied</p>
              <p className="text-sm text-gray-700">{itemsSupplied(view).map((i) => i.name).join(', ') || 'None linked'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Purchase history</p>
              <DataTable columns={[
                { key: 'number', label: 'PO #' },
                { key: 'created_at', label: 'Date', render: (po) => new Date(po.created_at).toLocaleDateString() },
                { key: 'status', label: 'Status', render: (po) => <Badge color={po.status === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>{po.status}</Badge> },
                { key: 'total', label: 'Total', render: (po) => cur(po.total) },
              ]} rows={posOf(view)} empty="No purchase orders" />
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form?.id ? `Edit ${form.name}` : 'New supplier'}
        footer={<><Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn><Btn onClick={save}>Save supplier</Btn></>}>
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Contact person"><input className={inputCls} value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Tax ID"><input className={inputCls} value={form.tax_id} onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))} /></Field>
            <Field label="Payment terms"><input className={inputCls} value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} /></Field>
            <Field label="Address" ><input className={inputCls} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
            <Field label="Opening balance"><input type="number" step="0.01" className={inputCls} value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Meta({ label, value }) {
  return <div><p className="text-xs text-gray-400">{label}</p><p className="text-gray-800 font-medium">{value}</p></div>
}
