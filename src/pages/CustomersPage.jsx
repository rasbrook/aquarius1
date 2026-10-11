import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { db } from '../lib/supabase'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, SearchInput, useDebounce, useCurrency, toast, Tabs } from '../components/ui'
import { Plus, Crown, Sparkles, Gift } from 'lucide-react'

const SEGMENT_COLORS = { VIP: 'bg-purple-100 text-purple-700', Frequent: 'bg-emerald-100 text-emerald-700', Regular: 'bg-blue-100 text-blue-700', New: 'bg-amber-100 text-amber-700', Inactive: 'bg-gray-100 text-gray-500' }

export default function CustomersPage() {
  const s = useRMS()
  const { user } = useAuth()
  const cur = useCurrency()
  const [tab, setTab] = useState('customers')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [view, setView] = useState(null)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [redeem, setRedeem] = useState({ customer_id: '', points: '' })

  const customers = useMemo(() => {
    let list = [...s.customers].sort((a, b) => b.total_spent - a.total_spent)
    if (dq) list = list.filter((c) => c.name.toLowerCase().includes(dq.toLowerCase()) || c.phone.includes(dq) || (c.email || '').toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.customers, dq])

  const loy = s.settings.loyalty
  const saveLoyaltySetting = async (key, value) => {
    const nextLoyalty = { ...loy, [key]: value }
    update((st) => { st.settings.loyalty = nextLoyalty })
    if (!user?.id) { toast('You must be signed in to save loyalty settings', 'error'); return }
    const { error } = await db('restaurants').update({ loyalty_settings: nextLoyalty, updated_at: new Date().toISOString() }).eq('owner_id', user.id)
    if (error) toast('Could not save loyalty settings', 'error')
  }
  const ordersOf = (c) => s.orders.filter((o) => o.customer_id === c.id && o.status === 'completed')
  const avgAOV = customers.length ? customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length : 0

  const openEdit = (c) => { setForm(c ? { ...c } : { id: null, name: '', phone: '', email: '', birthday: '', address: '', points: 0, segment: 'New' }); setEditOpen(true) }

  const save = () => {
    if (!form.name) { toast('Name required', 'error'); return }
    update((st) => {
      if (form.id) Object.assign(st.customers.find((x) => x.id === form.id), form)
      else st.customers.push({ ...form, id: `cus_${Math.random().toString(36).slice(2, 9)}`, visits: 0, total_spent: 0, last_visit: null })
      logAudit(st, { user: 'Staff', action: form.id ? 'update' : 'create', entity: 'customer', entity_id: form.name })
    })
    setEditOpen(false)
    toast('Customer saved')
  }

  const doRedeem = () => {
    const c = s.customers.find((x) => x.id === redeem.customer_id)
    const pts = Number(redeem.points)
    if (!c || !pts) { toast('Select customer and points', 'error'); return }
    if (pts < loy.min_redemption) { toast(`Minimum redemption is ${loy.min_redemption} points`, 'error'); return }
    if (c.points < pts) { toast('Insufficient points', 'error'); return }
    update((st) => {
      const x = st.customers.find((y) => y.id === c.id)
      x.points -= pts
      st.loyalty_transactions = st.loyalty_transactions || []
      st.loyalty_transactions.unshift({ id: `lt_${Date.now()}`, customer_id: x.id, points: -pts, value: Math.round(pts * loy.redemption_rate * 100) / 100, note: 'Redemption', created_at: new Date().toISOString() })
      logAudit(st, { user: 'Staff', action: 'redeem', entity: 'loyalty', entity_id: x.name, new: `${pts} pts` })
    })
    setRedeemOpen(false)
    setRedeem({ customer_id: '', points: '' })
    toast(`${pts} points redeemed for ${cur(pts * loy.redemption_rate)}`)
  }

  return (
    <div>
      <PageHeader title="Customers" subtitle="CRM, loyalty and segmentation"
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search customers…" className="w-56" />
          {loy.enabled && <Btn variant="secondary" onClick={() => setRedeemOpen(true)}><Gift size={15} /> Redeem points</Btn>}
          <Btn onClick={() => openEdit(null)}><Plus size={15} /> New Customer</Btn>
        </>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'customers', label: 'Customers' },
        { key: 'loyalty', label: 'Loyalty Program' },
      ]} />

      {tab === 'customers' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard label="Customers" value={customers.length} />
            <StatCard label="Avg lifetime spend" value={cur(avgAOV)} />
            <StatCard label="VIP" value={customers.filter((c) => c.segment === 'VIP').length} />
            <StatCard label="Points outstanding" value={customers.reduce((sum, c) => sum + c.points, 0)} />
          </div>
          <Card pad={false}>
            <DataTable columns={[
              {
                key: 'name', label: 'Customer', render: (c) => (
                  <button className="text-left" onClick={() => setView(c)}>
                    <span className="font-medium text-gray-800 hover:text-emerald-700">{c.name}</span>
                    {c.segment === 'VIP' && <Crown size={12} className="inline ml-1 text-purple-500" />}
                  </button>
                )
              },
              { key: 'phone', label: 'Phone' },
              { key: 'visits', label: 'Visits' },
              { key: 'total_spent', label: 'Total spent', render: (c) => <span className="font-semibold">{cur(c.total_spent)}</span> },
              { key: 'aov', label: 'Avg order', render: (c) => cur(c.visits ? c.total_spent / c.visits : 0) },
              { key: 'points', label: 'Points', render: (c) => <span className="flex items-center gap-1"><Sparkles size={12} className="text-amber-500" />{c.points}</span> },
              { key: 'last_visit', label: 'Last visit', render: (c) => c.last_visit ? new Date(c.last_visit).toLocaleDateString() : '—' },
              { key: 'segment', label: 'Segment', render: (c) => <Badge color={SEGMENT_COLORS[c.segment]}>{c.segment}</Badge> },
              { key: 'actions', label: '', render: (c) => <Btn size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Btn> },
            ]} rows={customers} />
          </Card>
        </>
      )}

      {tab === 'loyalty' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Program configuration">
            <div className="grid grid-cols-2 gap-3 p-2">
              <Field label="Enabled">
                <Select value={String(loy.enabled)} onChange={(v) => saveLoyaltySetting('enabled', v === 'true')}
                  options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
              </Field>
              <Field label={`Points per ${cur(1)} spent`}>
                <input type="number" step="0.1" className={inputCls} value={loy.points_per_currency}
                  onChange={(e) => saveLoyaltySetting('points_per_currency', Number(e.target.value))} />
              </Field>
              <Field label="Redemption value per point">
                <input type="number" step="0.01" className={inputCls} value={loy.redemption_rate}
                  onChange={(e) => saveLoyaltySetting('redemption_rate', Number(e.target.value))} />
              </Field>
              <Field label="Minimum redemption (points)">
                <input type="number" className={inputCls} value={loy.min_redemption}
                  onChange={(e) => saveLoyaltySetting('min_redemption', Number(e.target.value))} />
              </Field>
            </div>
            <p className="text-xs text-gray-400 px-4 pb-4">Example: {loy.points_per_currency} pt per {cur(1)} · {loy.min_redemption} pts = {cur(loy.min_redemption * loy.redemption_rate)} off.</p>
          </Card>
          <Card title="Recent point movements">
            <DataTable columns={[
              { key: 'created_at', label: 'Date', render: (t) => new Date(t.created_at).toLocaleDateString() },
              { key: 'customer', label: 'Customer', render: (t) => s.customers.find((c) => c.id === t.customer_id)?.name || t.customer_id },
              { key: 'points', label: 'Points', render: (t) => <span className={t.points >= 0 ? 'text-emerald-600' : 'text-red-600'}>{t.points > 0 ? '+' : ''}{t.points}</span> },
              { key: 'note', label: 'Note' },
            ]} rows={(s.loyalty_transactions || []).slice(0, 20)} empty="No redemptions yet — points are awarded automatically on completed orders" />
          </Card>
        </div>
      )}

      {/* Customer detail */}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.name} width="max-w-2xl"
        footer={view && <Btn onClick={() => { openEdit(view); setView(null) }}>Edit customer</Btn>}>
        {view && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge color={SEGMENT_COLORS[view.segment]}>{view.segment}</Badge>
              <Badge color="bg-amber-100 text-amber-700"><Sparkles size={11} className="mr-0.5" />{view.points} pts</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Mini label="Phone" value={view.phone} />
              <Mini label="Email" value={view.email || '—'} />
              <Mini label="Birthday" value={view.birthday || '—'} />
              <Mini label="Address" value={view.address || '—'} />
              <Mini label="Total spent" value={cur(view.total_spent)} />
              <Mini label="Avg order value" value={cur(view.visits ? view.total_spent / view.visits : 0)} />
              <Mini label="Visits" value={view.visits} />
              <Mini label="Last visit" value={view.last_visit ? new Date(view.last_visit).toLocaleDateString() : 'Never'} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Order history</p>
              <DataTable columns={[
                { key: 'number', label: 'Order #' },
                { key: 'created_at', label: 'Date', render: (o) => new Date(o.created_at).toLocaleDateString() },
                { key: 'type', label: 'Type', render: (o) => o.type.replace('_', ' ') },
                { key: 'total', label: 'Total', render: (o) => cur(o.total) },
                { key: 'status', label: 'Status', render: (o) => <Badge color={o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{o.status}</Badge> },
              ]} rows={ordersOf(view).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))} empty="No orders yet" />
            </div>
          </div>
        )}
      </Modal>

      {/* Editor */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form?.id ? `Edit ${form.name}` : 'New customer'}
        footer={<><Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn><Btn onClick={save}>Save customer</Btn></>}>
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Birthday"><input type="date" className={inputCls} value={form.birthday || ''} onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))} /></Field>
            <Field label="Address"><input className={inputCls} value={form.address || ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
            <Field label="Segment">
              <Select value={form.segment} onChange={(v) => setForm((f) => ({ ...f, segment: v }))}
                options={['VIP', 'Frequent', 'Regular', 'New', 'Inactive'].map((x) => ({ value: x, label: x }))} />
            </Field>
            <Field label="Loyalty points"><input type="number" className={inputCls} value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) }))} /></Field>
          </div>
        )}
      </Modal>

      {/* Redeem */}
      <Modal open={redeemOpen} onClose={() => setRedeemOpen(false)} title="Redeem loyalty points" width="max-w-sm"
        footer={<><Btn variant="secondary" onClick={() => setRedeemOpen(false)}>Cancel</Btn><Btn onClick={doRedeem}>Redeem</Btn></>}>
        <div className="space-y-3">
          <Field label="Customer">
            <Select value={redeem.customer_id} onChange={(v) => setRedeem((r) => ({ ...r, customer_id: v }))}
              options={[{ value: '', label: 'Choose…' }, ...s.customers.filter((c) => c.points >= loy.min_redemption).map((c) => ({ value: c.id, label: `${c.name} (${c.points} pts)` }))]} />
          </Field>
          <Field label={`Points to redeem (min ${loy.min_redemption})`}>
            <input type="number" className={inputCls} value={redeem.points} onChange={(e) => setRedeem((r) => ({ ...r, points: e.target.value }))} />
          </Field>
          {redeem.points && <p className="text-sm text-emerald-700 font-medium">Worth {cur(Number(redeem.points) * loy.redemption_rate)} off</p>}
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ label, value }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-bold text-gray-900 mt-1">{value}</p></div>
}
function Mini({ label, value }) {
  return <div><p className="text-xs text-gray-400">{label}</p><p className="text-gray-800 font-medium">{value}</p></div>
}
