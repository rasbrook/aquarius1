import { useState } from 'react'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, useCurrency, toast } from '../components/ui'
import { Plus, Tag } from 'lucide-react'

export default function PromotionsPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)

  const openEdit = (p) => setForm(p ? { ...p } : {
    id: null, name: '', type: 'percentage', value: 10, scope: 'order',
    product_ids: [], category_ids: [], code: '', start: new Date().toISOString().slice(0, 10),
    end: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), active: true, times_redeemed: 0,
    max_redemptions: '', single_use_per_customer: false, daypart_start: '', daypart_end: '',
  })

  const save = () => {
    if (!form.name) { toast('Name required', 'error'); return }
    update((st) => {
      const rec = { ...form, value: Number(form.value), start: new Date(form.start).toISOString(), end: new Date(form.end + 'T23:59:59').toISOString() }
      if (rec.id) Object.assign(st.promotions.find((x) => x.id === rec.id), rec)
      else st.promotions.push({ ...rec, id: `prm_${Math.random().toString(36).slice(2, 9)}` })
      logAudit(st, { user: 'Marketing', action: rec.id ? 'update' : 'create', entity: 'promotion', entity_id: rec.name })
    })
    setEditOpen(false)
    toast('Promotion saved')
  }

  const scopeLabel = (p) => {
    if (p.scope === 'order') return 'Whole order'
    if (p.scope === 'product') return p.product_ids.map((id) => s.products.find((x) => x.id === id)?.name).filter(Boolean).join(', ') || 'Products'
    if (p.scope === 'category') return p.category_ids.map((id) => s.categories.find((x) => x.id === id)?.name).filter(Boolean).join(', ') || 'Categories'
    return p.scope
  }

  return (
    <div>
      <PageHeader title="Promotions & Discounts" subtitle="Coupons, percentage/fixed discounts and BOGO"
        actions={<Btn onClick={() => { openEdit(null); setEditOpen(true) }}><Plus size={15} /> New Promotion</Btn>} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {s.promotions.map((p) => (
          <div key={p.id} className={`bg-white border rounded-xl p-4 shadow-sm ${p.active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-emerald-600" />
                <p className="font-semibold text-gray-900">{p.name}</p>
              </div>
              <Badge color={p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{p.active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {p.type === 'percentage' ? `${p.value}% off` : p.type === 'fixed' ? `${cur(p.value)} off` : 'Buy one get one'}
              <span className="text-gray-400"> · {scopeLabel(p)}</span>
            </p>
            {p.code && <p className="text-xs mt-1.5"><span className="bg-gray-100 border border-dashed border-gray-300 rounded px-2 py-0.5 font-mono font-semibold text-gray-700">{p.code}</span></p>}
            <p className="text-xs text-gray-400 mt-2">{new Date(p.start).toLocaleDateString()} → {new Date(p.end).toLocaleDateString()}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">Redeemed {p.times_redeemed}×</span>
              <div className="flex gap-1">
                <Btn size="sm" variant="ghost" onClick={() => { openEdit(p); setEditOpen(true) }}>Edit</Btn>
                <Btn size="sm" variant={p.active ? 'secondary' : 'primary'} onClick={() => { update((st) => { st.promotions.find((x) => x.id === p.id).active = !p.active }); toast(p.active ? 'Deactivated' : 'Activated') }}>
                  {p.active ? 'Deactivate' : 'Activate'}
                </Btn>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form?.id ? `Edit ${form.name}` : 'New promotion'}
        footer={<><Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn><Btn onClick={save}>Save promotion</Btn></>}>
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Type"><Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))}
              options={[{ value: 'percentage', label: 'Percentage %' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'bogo', label: 'Buy one get one' }]} /></Field>
            <Field label="Value (% or amount)"><input type="number" step="0.01" className={inputCls} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} /></Field>
            <Field label="Scope"><Select value={form.scope} onChange={(v) => setForm((f) => ({ ...f, scope: v }))}
              options={[{ value: 'order', label: 'Whole order' }, { value: 'product', label: 'Specific products' }, { value: 'category', label: 'Category' }]} /></Field>
            {form.scope === 'product' && (
              <Field label="Products">
                <Select value={form.product_ids[0] || ''} onChange={(v) => setForm((f) => ({ ...f, product_ids: v ? [v] : [] }))}
                  options={[{ value: '', label: 'Choose…' }, ...s.products.map((p) => ({ value: p.id, label: p.name }))]} />
              </Field>
            )}
            {form.scope === 'category' && (
              <Field label="Category">
                <Select value={form.category_ids[0] || ''} onChange={(v) => setForm((f) => ({ ...f, category_ids: v ? [v] : [] }))}
                  options={[{ value: '', label: 'Choose…' }, ...s.categories.map((c) => ({ value: c.id, label: c.name }))]} />
              </Field>
            )}
            <Field label="Coupon code (optional)"><input className={inputCls} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Maximum redemptions"><input type="number" min="1" className={inputCls} value={form.max_redemptions || ''} onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value ? Number(e.target.value) : '' }))} placeholder="No limit" /></Field>
            <Field label="Single-use per customer"><Select value={String(Boolean(form.single_use_per_customer))} onChange={(value) => setForm((f) => ({ ...f, single_use_per_customer: value === 'true' }))} options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]} /></Field>
            <Field label="Start date"><input type="date" className={inputCls} value={form.start?.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} /></Field>
            <Field label="End date"><input type="date" className={inputCls} value={form.end?.slice(0, 10)} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} /></Field>
            <Field label="Happy hour starts"><input type="time" className={inputCls} value={form.daypart_start || ''} onChange={(e) => setForm((f) => ({ ...f, daypart_start: e.target.value }))} /></Field>
            <Field label="Happy hour ends"><input type="time" className={inputCls} value={form.daypart_end || ''} onChange={(e) => setForm((f) => ({ ...f, daypart_end: e.target.value }))} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
