import { useMemo, useState } from 'react'
import {
  useRMS, update, openRegister, closeRegister, registerExpectedCash,
  logAudit, notify,
} from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Confirm, Field, inputCls, Select, DataTable, useCurrency, toast, Tabs, Stat } from '../components/ui'
import { Plus, Lock, Unlock, ArrowUpCircle, ArrowDownCircle, Printer, ShieldAlert, Trash2 } from 'lucide-react'

export default function CashPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [tab, setTab] = useState('registers')
  const [openOpen, setOpenOpen] = useState(false)
  const [closeTarget, setCloseTarget] = useState(null)
  const [flowOpen, setFlowOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [openForm, setOpenForm] = useState({ register_id: '', cashier: '', opening_cash: '200' })
  const [closeForm, setCloseForm] = useState({ actual: '' })
  const [flowForm, setFlowForm] = useState({ type: 'out', amount: '', reason: '', notes: '' })

  const sessions = [...s.register_sessions].sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at))
  const openSessions = sessions.filter((x) => x.status === 'open')
  const regOf = (id) => s.cash_registers.find((r) => r.id === id)

  // cash flow aggregation
  const flows = useMemo(() => {
    const rows = []
    s.orders.filter((o) => o.payment_status === 'paid').forEach((o) => o.payments.filter((p) => p.method === 'Cash').forEach((p) => {
      rows.push({ date: o.created_at, kind: 'in', category: `Sales (${p.method})`, amount: p.amount, ref: o.number, user: 'POS' })
    }))
    s.cash_transactions.forEach((t) => rows.push({ date: t.created_at, kind: t.type, category: t.reason, amount: t.amount, ref: t.reference, user: t.user, notes: t.notes }))
    s.expenses.filter((e) => e.status === 'approved' && e.payment_method === 'Cash').forEach((e) => {
      rows.push({ date: e.date, kind: 'out', category: `Expense: ${e.category}`, amount: e.amount, ref: e.number, user: e.created_by })
    })
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [s.orders, s.cash_transactions, s.expenses])

  const totalIn = flows.filter((f) => f.kind === 'in').reduce((sum, f) => sum + f.amount, 0)
  const totalOut = flows.filter((f) => f.kind === 'out').reduce((sum, f) => sum + f.amount, 0)
  const openingBalance = s.register_sessions.filter((x) => x.status === 'closed').reduce((sum, x) => sum + x.opening_cash, 0) + (openSessions[0]?.opening_cash || 0)
  const closingBalance = openingBalance + totalIn - totalOut

  const doOpen = () => {
    const res = update((st) => openRegister(st, { register_id: openForm.register_id, cashier: openForm.cashier, opening_cash: Number(openForm.opening_cash) }))
    if (res?.error) { toast(res.error, 'error'); return }
    setOpenOpen(false)
    toast('Register opened')
  }

  const doFlow = () => {
    const session = openSessions[0]
    if (!session) { toast('No open register session', 'error'); return }
    if (!flowForm.amount || !flowForm.reason) { toast('Amount and reason required', 'error'); return }
    update((st) => {
      st.cash_transactions.unshift({
        id: `ct_${Math.random().toString(36).slice(2, 9)}`, session_id: session.id,
        type: flowForm.type, amount: Number(flowForm.amount), reason: flowForm.reason,
        reference: `CT-${Date.now().toString().slice(-6)}`, notes: flowForm.notes, user: flowForm.type === 'out' ? 'Cashier' : 'Manager',
        created_at: new Date().toISOString(),
      })
      logAudit(st, { user: 'Cashier', action: flowForm.type === 'out' ? 'cash_out' : 'cash_in', entity: 'cash_transaction', entity_id: flowForm.reason, new: cur(flowForm.amount) })
    })
    setFlowOpen(false)
    setFlowForm({ type: 'out', amount: '', reason: '', notes: '' })
    toast('Cash movement recorded')
  }

  const doClose = () => {
    const res = update((st) => closeRegister(st, closeTarget.id, { actual_cash: Number(closeForm.actual), user: 'John Carter' }))
    if (res?.error) { toast(res.error, 'error'); return }
    if (Math.abs(res.variance) >= s.settings.pos.large_variance_threshold) toast(`Variance ${cur(res.variance)} — flagged for manager approval`, 'error')
    else toast(`Register closed. Variance: ${cur(res.variance)}`)
    setCloseTarget(null)
    setCloseForm({ actual: '' })
  }

  const removeSession = () => {
    const result = update((st) => {
      const index = st.register_sessions.findIndex((session) => session.id === removeTarget?.id)
      if (index < 0) return { error: 'Register session no longer exists' }
      const [session] = st.register_sessions.splice(index, 1)
      logAudit(st, {
        user: 'Manager',
        action: 'delete',
        entity: 'register_session',
        entity_id: session.id,
        prev: `${session.register_id} / ${session.cashier} / ${session.status}`,
      })
    })
    if (result?.error) { toast(result.error, 'error'); return }
    setRemoveTarget(null)
    toast('Register session removed; cash movement records were kept')
  }

  const expectedOf = (ses) => registerExpectedCash(s, ses)

  return (
    <div>
      <PageHeader title="Cash Management" subtitle="Registers, sessions and cash movements"
        actions={<>
          <Btn variant="secondary" onClick={() => setFlowOpen(true)}><Plus size={15} /> Cash In / Out</Btn>
          <Btn onClick={() => setOpenOpen(true)} disabled={!!openSessions.length}><Unlock size={15} /> Open Register</Btn>
        </>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Opening balance (all sessions)" value={cur(openingBalance)} />
        <Stat label="Total cash in" value={cur(totalIn)} tone="green" />
        <Stat label="Total cash out" value={cur(totalOut)} tone="red" />
        <Stat label="Closing balance" value={cur(closingBalance)} tone={closingBalance >= 0 ? 'green' : 'red'} />
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'registers', label: 'Register Sessions' },
        { key: 'flows', label: 'Cash Movements' },
      ]} />

      {tab === 'registers' && (
        <Card pad={false}>
          <DataTable columns={[
            { key: 'register_id', label: 'Register', render: (ses) => regOf(ses.register_id)?.name || ses.register_id },
            { key: 'cashier', label: 'Cashier' },
            { key: 'opened_at', label: 'Opened', render: (ses) => new Date(ses.opened_at).toLocaleString() },
            { key: 'opening_cash', label: 'Opening cash', render: (ses) => cur(ses.opening_cash) },
            { key: 'status', label: 'Status', render: (ses) => <Badge color={ses.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>{ses.status}</Badge> },
            { key: 'expected_cash', label: 'Expected', render: (ses) => ses.status === 'open' ? <span className="text-gray-500">{cur(expectedOf(ses))}</span> : <span>{cur(ses.expected_cash)}</span> },
            { key: 'closing', label: 'Actual / Variance', render: (ses) => ses.status === 'closed' ? (
              <span className={ses.variance === 0 ? 'text-gray-700' : Math.abs(ses.variance) >= s.settings.pos.large_variance_threshold ? 'text-red-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {cur(ses.closing_cash)} / {ses.variance >= 0 ? '+' : ''}{cur(ses.variance)}
                {ses.approved_by === 'NEEDS_MANAGER_APPROVAL' && <ShieldAlert size={12} className="inline ml-1 text-red-500" />}
              </span>
            ) : '—' },
            { key: 'actions', label: '', render: (ses) => (
              <div className="flex gap-1">
                {ses.status === 'open' ? (
                  <Btn size="sm" variant="danger" onClick={() => { setCloseTarget(ses); setCloseForm({ actual: '' }) }}><Lock size={13} /> Close</Btn>
                ) : (
                  <Btn size="sm" variant="ghost" title="Print closing report" onClick={() => {
                    const w = window.open('', '_blank')
                    if (w) w.document.write(`<pre style="font-family:monospace">END OF SHIFT REPORT\n${regOf(ses.register_id)?.name}\nCashier: ${ses.cashier}\nOpened: ${new Date(ses.opened_at).toLocaleString()}\nClosing: ${ses.closed_at ? new Date(ses.closed_at).toLocaleString() : '-'}\nOpening cash: ${cur(ses.opening_cash)}\nExpected cash: ${cur(ses.expected_cash)}\nActual cash: ${cur(ses.closing_cash)}\nVariance: ${cur(ses.variance)}</pre>`)
                  }}><Printer size={13} /></Btn>
                )}
                <Btn size="sm" variant="ghost" title="Remove register session" aria-label={`Remove register session for ${ses.cashier}`} onClick={() => setRemoveTarget(ses)}>
                  <Trash2 size={14} />
                </Btn>
              </div>
            ) },
          ]} rows={sessions} />
        </Card>
      )}

      <Confirm
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeSession}
        title="Remove register session?"
        message={`Remove the register session for ${removeTarget?.cashier || 'this cashier'}? This cannot be undone. Cash movement records will be retained.`}
      />

      {tab === 'flows' && (
        <Card pad={false}>
          <DataTable columns={[
            { key: 'date', label: 'Date', render: (f) => new Date(f.date).toLocaleString() },
            { key: 'kind', label: 'Direction', render: (f) => f.kind === 'in' ? <span className="flex items-center gap-1 text-emerald-600"><ArrowUpCircle size={14} /> Cash in</span> : <span className="flex items-center gap-1 text-red-600"><ArrowDownCircle size={14} /> Cash out</span> },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', render: (f) => <span className="font-semibold">{cur(f.amount)}</span> },
            { key: 'ref', label: 'Reference' },
            { key: 'user', label: 'By' },
            { key: 'notes', label: 'Notes', render: (f) => f.notes || '—' },
          ]} rows={flows.slice(0, 120)} empty="No cash movements" />
        </Card>
      )}

      {/* Open register */}
      <Modal open={openOpen} onClose={() => setOpenOpen(false)} title="Open cash register"
        footer={<><Btn variant="secondary" onClick={() => setOpenOpen(false)}>Cancel</Btn><Btn onClick={doOpen}>Open register</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Register">
            <Select value={openForm.register_id} onChange={(v) => setOpenForm((f) => ({ ...f, register_id: v }))}
              options={[{ value: '', label: 'Choose…' }, ...s.cash_registers.map((r) => ({ value: r.id, label: `${r.name} (${s.branches.find((b) => b.id === r.branch_id)?.name})` }))]} />
          </Field>
          <Field label="Cashier">
            <Select value={openForm.cashier} onChange={(v) => setOpenForm((f) => ({ ...f, cashier: v }))}
              options={s.employees.filter((e) => e.department === 'Front of House' || e.role.includes('Manager')).map((e) => ({ value: e.name, label: e.name }))} />
          </Field>
          <Field label="Opening cash balance"><input type="number" step="0.01" className={inputCls} value={openForm.opening_cash} onChange={(e) => setOpenForm((f) => ({ ...f, opening_cash: e.target.value }))} /></Field>
        </div>
      </Modal>

      {/* Cash in/out */}
      <Modal open={flowOpen} onClose={() => setFlowOpen(false)} title="Record cash movement"
        footer={<><Btn variant="secondary" onClick={() => setFlowOpen(false)}>Cancel</Btn><Btn onClick={doFlow}>Record</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <Select value={flowForm.type} onChange={(v) => setFlowForm((f) => ({ ...f, type: v }))}
              options={[{ value: 'in', label: 'Cash in' }, { value: 'out', label: 'Cash out' }]} />
          </Field>
          <Field label="Amount"><input type="number" step="0.01" className={inputCls} value={flowForm.amount} onChange={(e) => setFlowForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Reason">
            <Select value={flowForm.reason} onChange={(v) => setFlowForm((f) => ({ ...f, reason: v }))}
              options={(flowForm.type === 'out'
                ? ['Petty cash', 'Supplier payment', 'Expense', 'Cash withdrawal', 'Refund', 'Other outflow']
                : ['Starting cash', 'Cash deposit', 'Other inflow']
              ).map((r) => ({ value: r, label: r }))} />
          </Field>
          <Field label="Notes"><input className={inputCls} value={flowForm.notes} onChange={(e) => setFlowForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
        <p className="text-xs text-gray-400 mt-3">A unique reference and timestamp are recorded automatically. Large or unauthorized movements are audit-logged.</p>
      </Modal>

      {/* Close register */}
      <Modal open={!!closeTarget} onClose={() => setCloseTarget(null)} title={closeTarget ? `Close ${regOf(closeTarget.register_id)?.name}` : ''}
        footer={<><Btn variant="secondary" onClick={() => setCloseTarget(null)}>Cancel</Btn><Btn variant="danger" onClick={doClose}>Close register</Btn></>}>
        {closeTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span>Opening cash</span><span>{cur(closeTarget.opening_cash)}</span></div>
              <div className="flex justify-between"><span>+ Cash sales & cash in</span><span>{cur(expectedOf(closeTarget) - closeTarget.opening_cash)}</span></div>
              <div className="flex justify-between font-semibold border-t border-gray-200 pt-1.5"><span>Expected cash in drawer</span><span>{cur(expectedOf(closeTarget))}</span></div>
            </div>
            <Field label="Actual cash counted">
              <input type="number" step="0.01" autoFocus className={inputCls} value={closeForm.actual} onChange={(e) => setCloseForm({ actual: e.target.value })} />
            </Field>
            {closeForm.actual !== '' && (
              <div className={`rounded-lg p-3 text-sm font-medium ${Number(closeForm.actual) - expectedOf(closeTarget) === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                Variance: {cur(Number(closeForm.actual) - expectedOf(closeTarget))}
                {Math.abs(Number(closeForm.actual) - expectedOf(closeTarget)) >= s.settings.pos.large_variance_threshold
                  ? ' — exceeds threshold and will require manager approval.' : ''}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
