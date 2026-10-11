import { useMemo, useState } from 'react'
import { useRMS, update, nextNumber, logAudit, notify } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, SearchInput, useDebounce, useCurrency, toast, Stat } from '../components/ui'
import { Plus, CheckCircle } from 'lucide-react'

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Maintenance', 'Transportation', 'Cleaning', 'Food Purchases', 'Equipment', 'Internet', 'Insurance', 'Taxes', 'Miscellaneous']
const METHODS = ['Cash', 'Card', 'Bank Transfer', 'Mobile Money']

export default function ExpensesPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [filter, setFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ category: 'Utilities', description: '', amount: '', date: new Date().toISOString().slice(0, 10), payment_method: 'Card', branch_id: s.branches[0]?.id || '', employee_id: '' })
  const [threshold, setThreshold] = useState(200)

  const rows = useMemo(() => {
    let list = [...s.expenses].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (filter !== 'all') list = list.filter((e) => (filter === 'pending' ? e.status === 'pending' : e.status === 'approved'))
    if (dq) list = list.filter((e) => e.description.toLowerCase().includes(dq.toLowerCase()) || e.number.toLowerCase().includes(dq.toLowerCase()) || e.category.toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.expenses, filter, dq])

  const totalApproved = s.expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0)
  const totalPending = s.expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0)
  const byCat = useMemo(() => {
    const m = {}
    s.expenses.filter((e) => e.status === 'approved').forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [s.expenses])

  const submit = () => {
    if (!form.description || !form.amount) { toast('Description and amount required', 'error'); return }
    const needsApproval = Number(form.amount) > threshold
    update((st) => {
      const exp = {
        id: `exp_${Math.random().toString(36).slice(2, 9)}`, number: nextNumber(st, 'expense'),
        category: form.category, description: form.description, amount: Number(form.amount),
        date: form.date, payment_method: form.payment_method, branch_id: form.branch_id,
        employee_id: form.employee_id || null, status: needsApproval ? 'pending' : 'approved',
        created_by: 'Demo User', receipt: '',
      }
      st.expenses.push(exp)
      logAudit(st, { user: 'Demo User', action: 'create', entity: 'expense', entity_id: exp.number, new: cur(exp.amount) })
      if (needsApproval) notify(st, 'expense', `Expense ${exp.number} (${cur(exp.amount)}) awaiting approval`)
    })
    setAddOpen(false)
    setForm({ ...form, description: '', amount: '' })
    toast(Number(form.amount) > threshold ? 'Expense submitted for approval' : 'Expense recorded')
  }

  const approve = (e) => {
    update((st) => {
      const x = st.expenses.find((y) => y.id === e.id)
      x.status = 'approved'
      logAudit(st, { user: 'Manager', action: 'approve', entity: 'expense', entity_id: e.number })
    })
    toast('Expense approved')
  }

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Expense tracking with approval workflow"
        actions={<>
          <SearchInput value={q} onChange={setQ} placeholder="Search expenses…" className="w-56" />
          <Btn onClick={() => { setForm((current) => ({ ...current, branch_id: s.branches.some((branch) => branch.id === current.branch_id) ? current.branch_id : s.branches[0]?.id || '' })); setAddOpen(true) }}><Plus size={15} /> New Expense</Btn>
        </>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Approved total" value={cur(totalApproved)} />
        <Stat label="Pending approval" value={cur(totalPending)} tone={totalPending ? 'orange' : 'gray'} />
        <Stat label="This month" value={cur(s.expenses.filter((e) => { const d = new Date(e.date); const n = new Date(); return e.status === 'approved' && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).reduce((sum, e) => sum + e.amount, 0))} />
        <Stat label="Top category" value={byCat[0] ? `${byCat[0][0]} (${cur(byCat[0][1])})` : '—'} />
      </div>

      <div className="flex gap-1.5 mb-4">
        {[['all', `All (${s.expenses.length})`], ['pending', `Pending (${s.expenses.filter((e) => e.status === 'pending').length})`], ['approved', 'Approved']].map(([v, l]) => (
          <Btn key={v} size="sm" variant={filter === v ? 'primary' : 'secondary'} onClick={() => setFilter(v)}>{l}</Btn>
        ))}
      </div>

      <Card pad={false}>
        <DataTable columns={[
          { key: 'number', label: '#', render: (e) => <span className="text-gray-500">{e.number}</span> },
          { key: 'date', label: 'Date', render: (e) => new Date(e.date).toLocaleDateString() },
          { key: 'category', label: 'Category', render: (e) => <Badge color="bg-gray-100 text-gray-600">{e.category}</Badge> },
          { key: 'description', label: 'Description', render: (e) => <span className="text-gray-800">{e.description}</span> },
          { key: 'branch_id', label: 'Branch', render: (e) => s.branches.find((b) => b.id === e.branch_id)?.name },
          { key: 'payment_method', label: 'Method' },
          { key: 'amount', label: 'Amount', render: (e) => <span className="font-semibold">{cur(e.amount)}</span> },
          { key: 'status', label: 'Status', render: (e) => <Badge color={e.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>{e.status}</Badge> },
          { key: 'created_by', label: 'By' },
          { key: 'actions', label: '', render: (e) => e.status === 'pending' ? <Btn size="sm" onClick={() => approve(e)}><CheckCircle size={13} /> Approve</Btn> : null },
        ]} rows={rows} empty="No expenses found" />
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New expense"
        footer={<><Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn><Btn onClick={submit}>Submit expense</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
          <Field label="Amount"><input type="number" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Description" ><input className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Payment method"><Select value={form.payment_method} onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))} options={METHODS.map((m) => ({ value: m, label: m }))} /></Field>
          <Field label="Branch"><Select value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))} options={[{ value: '', label: 'No branch' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} /></Field>
          <Field label="Employee">
            <Select value={form.employee_id} onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
              options={[{ value: '', label: 'None' }, ...s.employees.map((e) => ({ value: e.id, label: e.name }))]} />
          </Field>
          <Field label="Approval threshold" hint={`Expenses above ${cur(threshold)} require approval`}>
            <input type="number" className={inputCls} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </Field>
        </div>
        <p className="text-xs text-gray-400 mt-3">Receipt attachments (Supabase Storage) activate when a backend is connected.</p>
      </Modal>
    </div>
  )
}
