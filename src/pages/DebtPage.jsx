import { useState } from 'react'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, useCurrency, toast, Stat } from '../components/ui'
import { Plus, Banknote, ChevronDown, Clock3 } from 'lucide-react'

const DEBT_TYPES = ['Bank loan', 'Rent arrears', 'Personal loan', 'Supplier debt', 'Other']
const METHODS = ['Cash', 'Bank Transfer', 'Mobile Money', 'Other']

const today = () => new Date().toISOString().slice(0, 10)

function emptyDebt() {
    return { name: '', type: 'Bank loan', creditor: '', original_amount: '', balance: '', interest_rate: '', due_date: '', created_at: today(), notes: '' }
}

export default function DebtPage() {
    const s = useRMS()
    const cur = useCurrency()
    const [addOpen, setAddOpen] = useState(false)
    const [paymentDebt, setPaymentDebt] = useState(null)
    const [historyDebt, setHistoryDebt] = useState(null)
    const [debtForm, setDebtForm] = useState(emptyDebt)
    const [paymentForm, setPaymentForm] = useState({ amount: '', date: today(), method: 'Bank Transfer', note: '' })

    const debts = [...(s.debts || [])].sort((a, b) => Number(b.balance) - Number(a.balance))
    const totalOutstanding = debts.reduce((sum, debt) => sum + Number(debt.balance || 0), 0)
    const totalOriginal = debts.reduce((sum, debt) => sum + Number(debt.original_amount || 0), 0)
    const totalPaid = debts.reduce((sum, debt) => sum + (debt.payments || []).reduce((paid, payment) => paid + Number(payment.amount || 0), 0), 0)

    const addDebt = () => {
        const originalAmount = Number(debtForm.original_amount)
        const balance = Number(debtForm.balance || debtForm.original_amount)
        if (!debtForm.name.trim() || !debtForm.creditor.trim() || !originalAmount || !balance || balance > originalAmount) {
            toast('Enter a creditor, debt name, and valid balances', 'error')
            return
        }
        const debt = {
            ...debtForm,
            id: `debt_${Math.random().toString(36).slice(2, 9)}`,
            name: debtForm.name.trim(),
            creditor: debtForm.creditor.trim(),
            original_amount: originalAmount,
            balance,
            payments: [],
        }
        update((state) => {
            state.debts = state.debts || []
            state.debts.unshift(debt)
            logAudit(state, { action: 'create', entity: 'debt', entity_id: debt.name, new: cur(balance) })
        })
        setAddOpen(false)
        setDebtForm(emptyDebt())
        toast('Debt recorded')
    }

    const openPayment = (debt) => {
        setPaymentDebt(debt)
        setPaymentForm({ amount: '', date: today(), method: 'Bank Transfer', note: '' })
    }

    const recordPayment = () => {
        const amount = Number(paymentForm.amount)
        if (!amount || amount <= 0 || amount > Number(paymentDebt.balance)) {
            toast('Enter a payment up to the outstanding balance', 'error')
            return
        }
        update((state) => {
            const debt = state.debts.find((item) => item.id === paymentDebt.id)
            if (!debt || amount > Number(debt.balance)) return
            debt.balance = Math.max(0, Number(debt.balance) - amount)
            debt.payments = debt.payments || []
            debt.payments.unshift({
                id: `payment_${Math.random().toString(36).slice(2, 9)}`,
                amount,
                date: paymentForm.date,
                method: paymentForm.method,
                note: paymentForm.note.trim(),
            })
            logAudit(state, { action: 'payment', entity: 'debt', entity_id: debt.name, prev: cur(Number(debt.balance) + amount), new: cur(debt.balance) })
        })
        setPaymentDebt(null)
        toast('Payment recorded')
    }

    return (
        <div>
            <PageHeader title="Debt Tracker" subtitle="Track what you owe and record repayments"
                actions={<Btn onClick={() => setAddOpen(true)}><Plus size={15} /> Record debt</Btn>} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <Stat label="Outstanding debt" value={cur(totalOutstanding)} tone="red" />
                <Stat label="Original debt" value={cur(totalOriginal)} />
                <Stat label="Paid so far" value={cur(totalPaid)} tone="green" />
            </div>

            <Card pad={false}>
                {debts.length === 0 ? <p className="px-5"><span className="block py-10 text-center text-sm text-gray-400">No debts recorded</span></p> : (
                    <div className="divide-y divide-gray-100">
                        {debts.map((debt) => (
                            <details key={debt.id} className="group">
                                <summary className="grid list-none cursor-pointer grid-cols-1 gap-3 px-4 py-4 marker:hidden hover:bg-gray-50/70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <ChevronDown size={17} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-gray-900">{debt.name}</p>
                                                <Badge>{debt.type}</Badge>
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-gray-500">{debt.creditor}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pl-8 sm:pl-0">
                                        <div>
                                            <p className="text-xs text-gray-500">Outstanding</p>
                                            <p className="font-semibold text-gray-900">{cur(debt.balance)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Original amount</p>
                                            <p className="text-gray-700">{cur(debt.original_amount)}</p>
                                        </div>
                                    </div>
                                </summary>
                                <div className="px-4 pb-4 pl-11 sm:px-5 sm:pl-12">
                                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
                                        <div><p className="text-xs text-gray-500">Due date</p><p className="mt-1 text-gray-800">{debt.due_date ? new Date(`${debt.due_date}T00:00:00`).toLocaleDateString() : 'Not set'}</p></div>
                                        <div><p className="text-xs text-gray-500">Interest rate</p><p className="mt-1 text-gray-800">{debt.interest_rate ? `${debt.interest_rate}%` : 'Not set'}</p></div>
                                        <div><p className="text-xs text-gray-500">Date recorded</p><p className="mt-1 text-gray-800">{debt.created_at ? new Date(`${debt.created_at}T00:00:00`).toLocaleDateString() : 'Not set'}</p></div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {(debt.payments || []).length > 0 && <Btn size="sm" variant="secondary" onClick={() => setHistoryDebt(debt)}><Clock3 size={13} /> Payment history</Btn>}
                                        {Number(debt.balance) > 0 && <Btn size="sm" onClick={() => openPayment(debt)}><Banknote size={13} /> Record repayment</Btn>}
                                        {Number(debt.balance) === 0 && <Badge color="bg-emerald-100 text-emerald-700">Settled</Badge>}
                                    </div>
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </Card>

            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record debt"
                width="max-w-3xl"
                footer={<><Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn><Btn onClick={addDebt}>Save debt</Btn></>}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Debt name"><input className={inputCls} value={debtForm.name} onChange={(e) => setDebtForm((form) => ({ ...form, name: e.target.value }))} placeholder="e.g. Business loan" /></Field>
                    <Field label="Type"><Select value={debtForm.type} onChange={(value) => setDebtForm((form) => ({ ...form, type: value }))} options={DEBT_TYPES.map((type) => ({ value: type, label: type }))} /></Field>
                    <Field label="Creditor"><input className={inputCls} value={debtForm.creditor} onChange={(e) => setDebtForm((form) => ({ ...form, creditor: e.target.value }))} placeholder="Bank, landlord, supplier..." /></Field>
                    <Field label="Original amount"><input type="number" min="0" step="0.01" className={inputCls} value={debtForm.original_amount} onChange={(e) => setDebtForm((form) => ({ ...form, original_amount: e.target.value, balance: form.balance || e.target.value }))} /></Field>
                    <Field label="Current balance"><input type="number" min="0" step="0.01" className={inputCls} value={debtForm.balance} onChange={(e) => setDebtForm((form) => ({ ...form, balance: e.target.value }))} /></Field>
                    <Field label="Interest rate (%)"><input type="number" min="0" step="0.01" className={inputCls} value={debtForm.interest_rate} onChange={(e) => setDebtForm((form) => ({ ...form, interest_rate: e.target.value }))} placeholder="Optional" /></Field>
                    <Field label="Due date"><input type="date" className={inputCls} value={debtForm.due_date} onChange={(e) => setDebtForm((form) => ({ ...form, due_date: e.target.value }))} /></Field>
                    <Field label="Date recorded"><input type="date" className={inputCls} value={debtForm.created_at} onChange={(e) => setDebtForm((form) => ({ ...form, created_at: e.target.value }))} /></Field>
                </div>
            </Modal>

            <Modal open={Boolean(paymentDebt)} onClose={() => setPaymentDebt(null)} title={`Record repayment${paymentDebt ? ` · ${paymentDebt.name}` : ''}`}
                footer={<><Btn variant="secondary" onClick={() => setPaymentDebt(null)}>Cancel</Btn><Btn onClick={recordPayment}>Save payment</Btn></>}>
                {paymentDebt && <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <span className="text-gray-500">Outstanding balance</span><strong>{cur(paymentDebt.balance)}</strong>
                    </div>
                    <Field label="Payment amount"><input autoFocus type="number" min="0.01" max={paymentDebt.balance} step="0.01" className={inputCls} value={paymentForm.amount} onChange={(e) => setPaymentForm((form) => ({ ...form, amount: e.target.value }))} /></Field>
                    <Field label="Payment date"><input type="date" className={inputCls} value={paymentForm.date} onChange={(e) => setPaymentForm((form) => ({ ...form, date: e.target.value }))} /></Field>
                    <Field label="Method"><Select value={paymentForm.method} onChange={(value) => setPaymentForm((form) => ({ ...form, method: value }))} options={METHODS.map((method) => ({ value: method, label: method }))} /></Field>
                    <Field label="Note"><input className={inputCls} value={paymentForm.note} onChange={(e) => setPaymentForm((form) => ({ ...form, note: e.target.value }))} placeholder="Optional reference or note" /></Field>
                </div>}
            </Modal>

            <Modal open={Boolean(historyDebt)} onClose={() => setHistoryDebt(null)} title={`${historyDebt?.name || 'Debt'} · Payment history`}>
                <DataTable columns={[
                    { key: 'date', label: 'Date', render: (payment) => new Date(`${payment.date}T00:00:00`).toLocaleDateString() },
                    { key: 'amount', label: 'Amount', render: (payment) => <span className="font-semibold">{cur(payment.amount)}</span> },
                    { key: 'method', label: 'Method' },
                    { key: 'note', label: 'Note', render: (payment) => payment.note || '—' },
                ]} rows={historyDebt?.payments || []} empty="No payments recorded yet" />
            </Modal>
        </div>
    )
}