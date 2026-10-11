import { useState } from 'react'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, useCurrency, toast, Tabs } from '../components/ui'
import { Plus, ArrowRight } from 'lucide-react'

const TRF_FLOW = ['requested', 'approved', 'shipped', 'received']
const TRF_COLORS = { requested: 'bg-amber-100 text-amber-700', approved: 'bg-blue-100 text-blue-700', shipped: 'bg-indigo-100 text-indigo-700', received: 'bg-emerald-100 text-emerald-700' }

export default function BranchesPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [tab, setTab] = useState('branches')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [trfOpen, setTrfOpen] = useState(false)
  const [trf, setTrf] = useState({ from_branch: s.branches[0]?.id || '', to_branch: s.branches[1]?.id || '', ingredient_id: '', qty: '' })

  const openEdit = (b) => setForm(b ? { ...b } : { id: null, name: '', address: '', phone: '', manager: '' })

  const save = () => {
    if (!form.name) { toast('Name required', 'error'); return }
    update((st) => {
      if (form.id) Object.assign(st.branches.find((x) => x.id === form.id), form)
      else st.branches.push({ ...form, id: `br_${Math.random().toString(36).slice(2, 9)}` })
      logAudit(st, { user: 'Owner', action: form.id ? 'update' : 'create', entity: 'branch', entity_id: form.name })
    })
    setEditOpen(false)
    toast('Branch saved')
  }

  const branchStats = (b) => {
    const orders = s.orders.filter((o) => o.branch_id === b.id && o.status === 'completed')
    return {
      revenue: orders.reduce((sum, o) => sum + o.total, 0),
      orders: orders.length,
      tables: s.tables.filter((t) => t.branch_id === b.id).length,
      employees: s.employees.filter((e) => e.branch_id === b.id).length,
    }
  }

  const advanceTransfer = (t) => {
    const idx = TRF_FLOW.indexOf(t.status)
    if (idx >= TRF_FLOW.length - 1) return
    const next = TRF_FLOW[idx + 1]
    update((st) => {
      const x = st.transfers.find((y) => y.id === t.id)
      x.status = next
      // stock moves when shipped (leaves source) — symmetric update on receive for demo
      if (next === 'shipped' || next === 'received') {
        t.items.forEach((it) => {
          const ing = st.ingredients.find((i) => i.id === it.ingredient_id)
          if (ing) {
            const qty = next === 'shipped' ? -it.qty : it.qty
            // one shared inventory pool in demo mode; record transaction for both branches
            ing.quantity = Math.max(0, Math.round((ing.quantity + qty) * 100) / 100)
            st.inventory_transactions.unshift({ id: `itx_${Math.random().toString(36).slice(2, 9)}`, ingredient_id: it.ingredient_id, type: 'transfer', qty, reason: `Transfer ${next}: ${s.branches.find((b) => b.id === t.from_branch)?.name} → ${s.branches.find((b) => b.id === t.to_branch)?.name}`, ref: 'TRF', user: 'Manager', created_at: new Date().toISOString() })
          }
        })
      }
      logAudit(st, { user: 'Manager', action: next, entity: 'transfer', entity_id: `${t.from_branch}→${t.to_branch}` })
    })
    toast(`Transfer ${next}`)
  }

  const createTransfer = () => {
    if (trf.from_branch === trf.to_branch) { toast('Source and destination must differ', 'error'); return }
    if (!trf.ingredient_id || !trf.qty) { toast('Select item and quantity', 'error'); return }
    update((st) => {
      st.transfers.unshift({
        id: `trf_${Math.random().toString(36).slice(2, 9)}`, from_branch: trf.from_branch, to_branch: trf.to_branch,
        items: [{ ingredient_id: trf.ingredient_id, qty: Number(trf.qty) }], status: 'requested',
        date: new Date().toISOString(), user: 'Manager',
      })
    })
    setTrfOpen(false)
    setTrf({ from_branch: s.branches[0]?.id || '', to_branch: s.branches[1]?.id || '', ingredient_id: '', qty: '' })
    toast('Transfer requested')
  }

  return (
    <div>
      <PageHeader title="Branches" subtitle="Multi-location management and stock transfers"
        actions={<>
          <Btn variant="secondary" onClick={() => { setTrf({ from_branch: s.branches[0]?.id || '', to_branch: s.branches[1]?.id || '', ingredient_id: '', qty: '' }); setTrfOpen(true) }} disabled={s.branches.length < 2}><ArrowRight size={15} /> New Transfer</Btn>
          <Btn onClick={() => { openEdit(null); setEditOpen(true) }}><Plus size={15} /> New Branch</Btn>
        </>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'branches', label: 'Branches' },
        { key: 'transfers', label: `Transfers (${s.transfers.length})` },
      ]} />

      {tab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {s.branches.map((b) => {
            const stats = branchStats(b)
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{b.name}</p>
                    <p className="text-sm text-gray-500">{b.address} · {b.phone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Manager: {b.manager}</p>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={() => { openEdit(b); setEditOpen(true) }}>Edit</Btn>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-900">{cur(stats.revenue)}</p><p className="text-[10px] text-gray-400">Revenue</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-900">{stats.orders}</p><p className="text-[10px] text-gray-400">Orders</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-900">{stats.tables}</p><p className="text-[10px] text-gray-400">Tables</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-900">{stats.employees}</p><p className="text-[10px] text-gray-400">Staff</p></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'transfers' && (
        <Card pad={false}>
          <div className="p-4 space-y-2">
            {s.transfers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-200 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {s.branches.find((b) => b.id === t.from_branch)?.name} → {s.branches.find((b) => b.id === t.to_branch)?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.items.map((it) => `${it.qty} ${s.ingredients.find((i) => i.id === it.ingredient_id)?.unit} ${s.ingredients.find((i) => i.id === it.ingredient_id)?.name}`).join(', ')}
                    · {new Date(t.date).toLocaleDateString()} · by {t.user}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={TRF_COLORS[t.status]}>{t.status}</Badge>
                  {t.status !== 'received' && <Btn size="sm" onClick={() => advanceTransfer(t)}>{t.status === 'requested' ? 'Approve' : t.status === 'approved' ? 'Ship' : 'Receive'}</Btn>}
                </div>
              </div>
            ))}
            {!s.transfers.length && <p className="text-sm text-gray-400 text-center py-6">No transfers</p>}
          </div>
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form?.id ? `Edit ${form.name}` : 'New branch'}
        footer={<><Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn><Btn onClick={save}>Save branch</Btn></>}>
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Manager"><input className={inputCls} value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))} /></Field>
            <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={trfOpen} onClose={() => setTrfOpen(false)} title="New stock transfer"
        footer={<><Btn variant="secondary" onClick={() => setTrfOpen(false)}>Cancel</Btn><Btn onClick={createTransfer}>Request transfer</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From branch"><Select value={trf.from_branch} onChange={(v) => setTrf((t) => ({ ...t, from_branch: v }))} options={s.branches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="To branch"><Select value={trf.to_branch} onChange={(v) => setTrf((t) => ({ ...t, to_branch: v }))} options={s.branches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
          <Field label="Item">
            <Select value={trf.ingredient_id} onChange={(v) => setTrf((t) => ({ ...t, ingredient_id: v }))}
              options={[{ value: '', label: 'Choose…' }, ...s.ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.quantity} ${i.unit} on hand)` }))]} />
          </Field>
          <Field label="Quantity"><input type="number" step="0.01" className={inputCls} value={trf.qty} onChange={(e) => setTrf((t) => ({ ...t, qty: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}
