import { useMemo, useState } from 'react'
import { useRMS, update, logAudit, notify } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, useCurrency, toast } from '../components/ui'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, startOfWeek } from 'date-fns'

const STATUSES = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']
const STATUS_COLORS = { pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', seated: 'bg-emerald-100 text-emerald-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-700', no_show: 'bg-purple-100 text-purple-700' }
const HOURS = ['11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']

export default function ReservationsPage() {
  const s = useRMS()
  const [view, setView] = useState('list')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [addOpen, setAddOpen] = useState(false)
  const [timelineBranchId, setTimelineBranchId] = useState(s.branches[0]?.id || '')
  const [form, setForm] = useState({ customer_name: '', phone: '', date: format(new Date(), 'yyyy-MM-dd'), time: '19:00', guests: 2, table_id: '', special_request: '', branch_id: s.branches[0]?.id || '' })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const rsv = s.reservations
  const activeTimelineBranchId = s.branches.some((branch) => branch.id === timelineBranchId) ? timelineBranchId : s.branches[0]?.id || ''
  const timelineTables = s.tables.filter((table) => table.branch_id === activeTimelineBranchId)
  const tableOf = (r) => s.tables.find((t) => t.id === r.table_id)

  const setStatus = (r, status) => {
    update((st) => {
      const x = st.reservations.find((y) => y.id === r.id)
      x.status = status
      if (status === 'seated' && x.table_id) {
        const t = st.tables.find((y) => y.id === x.table_id)
        if (t && t.status === 'reserved') t.status = 'available'
      }
      if (status === 'confirmed' && x.table_id) {
        const t = st.tables.find((y) => y.id === x.table_id)
        if (t && t.status === 'available') t.status = 'reserved'
      }
      logAudit(st, { user: 'Host', action: 'update', entity: 'reservation', entity_id: r.customer_name, prev: r.status, new: status })
    })
    toast(`Reservation ${status.replace('_', ' ')}`)
  }

  const addReservation = () => {
    if (!form.customer_name || !form.phone) { toast('Name and phone are required', 'error'); return }
    update((st) => {
      st.reservations.push({ id: `rsv_${Math.random().toString(36).slice(2, 9)}`, ...form, branch_id: form.branch_id || null, guests: Number(form.guests), table_id: form.table_id || null, status: 'pending' })
      notify(st, 'reservation', `New reservation: ${form.customer_name}, ${form.guests} guests on ${form.date} ${form.time}`)
      logAudit(st, { user: 'Host', action: 'create', entity: 'reservation', entity_id: form.customer_name })
    })
    setAddOpen(false)
    setForm({ customer_name: '', phone: '', date: format(new Date(), 'yyyy-MM-dd'), time: '19:00', guests: 2, table_id: '', special_request: '', branch_id: s.branches[0]?.id || '' })
    toast('Reservation created')
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const upcoming = useMemo(() => rsv.filter((r) => r.date >= todayStr && !['completed', 'cancelled', 'no_show'].includes(r.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), [rsv, todayStr])

  return (
    <div>
      <PageHeader title="Reservations" subtitle="Bookings, calendar and seating"
        actions={<>
          <div className="flex gap-1">
            {['list', 'calendar', 'timeline'].map((v) => (
              <Btn key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} className="capitalize" onClick={() => setView(v)}>{v}</Btn>
            ))}
          </div>
          <Btn onClick={() => { setForm({ customer_name: '', phone: '', date: format(new Date(), 'yyyy-MM-dd'), time: '19:00', guests: 2, table_id: '', special_request: '', branch_id: s.branches[0]?.id || '' }); setAddOpen(true) }}><Plus size={16} /> New reservation</Btn>
        </>} />

      {view === 'list' && (
        <Card pad={false}>
          <DataTable columns={[
            { key: 'customer_name', label: 'Guest', render: (r) => <span className="font-medium text-gray-800">{r.customer_name}</span> },
            { key: 'phone', label: 'Phone' },
            { key: 'date', label: 'Date', render: (r) => format(new Date(r.date + 'T12:00'), 'EEE, MMM d') },
            { key: 'time', label: 'Time' },
            { key: 'guests', label: 'Guests' },
            { key: 'table', label: 'Table', render: (r) => tableOf(r) ? `T${tableOf(r).number}` : <span className="text-gray-400">Unassigned</span> },
            { key: 'special_request', label: 'Requests', render: (r) => r.special_request || '—' },
            { key: 'status', label: 'Status', render: (r) => <Badge color={STATUS_COLORS[r.status]}>{r.status.replace('_', ' ')}</Badge> },
            {
              key: 'actions', label: '', render: (r) => (
                <div className="flex gap-1 flex-wrap">
                  {r.status === 'pending' && <Btn size="sm" variant="secondary" onClick={() => setStatus(r, 'confirmed')}>Confirm</Btn>}
                  {r.status === 'confirmed' && <Btn size="sm" onClick={() => setStatus(r, 'seated')}>Seat</Btn>}
                  {['pending', 'confirmed'].includes(r.status) && (
                    <>
                      <Btn size="sm" variant="secondary" onClick={() => setStatus(r, 'completed')}>Complete</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setStatus(r, 'no_show')}>No-show</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setStatus(r, 'cancelled')}>Cancel</Btn>
                    </>
                  )}
                </div>
              )
            },
          ]} rows={[...upcoming, ...rsv.filter((r) => !upcoming.includes(r)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))]} empty="No reservations" />
        </Card>
      )}

      {view === 'calendar' && (
        <Card title={format(weekStart, 'MMMM yyyy')} actions={
          <div className="flex gap-1">
            <Btn size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={14} /></Btn>
            <Btn size="sm" variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Today</Btn>
            <Btn size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={14} /></Btn>
          </div>
        }>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d) => {
              const ds = format(d, 'yyyy-MM-dd')
              const dayRsv = rsv.filter((r) => r.date === ds)
              return (
                <div key={ds} className={`min-h-[9rem] rounded-lg border p-2 ${ds === todayStr ? 'border-emerald-400 bg-emerald-50/40' : 'border-gray-100'}`}>
                  <p className={`text-xs font-semibold mb-1.5 ${ds === todayStr ? 'text-emerald-700' : 'text-gray-500'}`}>{format(d, 'EEE d')}</p>
                  <div className="space-y-1">
                    {dayRsv.map((r) => (
                      <div key={r.id} className="bg-white border border-gray-200 rounded px-1.5 py-1 text-[11px]">
                        <span className="font-semibold">{r.time}</span> {r.customer_name}
                        <span className="block text-gray-400">{r.guests} guests{tableOf(r) ? ` · T${tableOf(r).number}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {view === 'timeline' && (
        <Card title="Today's seating timeline" actions={<Select value={activeTimelineBranchId} onChange={setTimelineBranchId}
          options={s.branches.length ? s.branches.map((branch) => ({ value: branch.id, label: branch.name })) : [{ value: '', label: 'No branches configured', disabled: true }]} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-2 text-gray-500 font-medium">Time</th>
                  {timelineTables.map((t) => <th key={t.id} className="p-2 text-gray-500 font-medium">T{t.number}</th>)}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h} className="border-t border-gray-50">
                    <td className="p-2 font-semibold text-gray-600 whitespace-nowrap">{h}</td>
                    {timelineTables.map((t) => {
                      const hit = rsv.find((r) => r.date === todayStr && r.time === h && r.table_id === t.id)
                      return <td key={t.id} className="p-1">{hit ? <div className="bg-emerald-100 text-emerald-800 rounded px-1.5 py-1">{hit.customer_name} ({hit.guests})</div> : null}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New reservation"
        footer={<><Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn><Btn onClick={addReservation}>Create reservation</Btn></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guest name"><input className={inputCls} value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} /></Field>
          <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Time"><input type="time" className={inputCls} value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} /></Field>
          <Field label="Guests"><input type="number" min="1" className={inputCls} value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))} /></Field>
          <Field label="Table">
            <Select value={form.table_id} onChange={(v) => setForm((f) => ({ ...f, table_id: v }))}
              options={[{ value: '', label: 'Auto-assign' }, ...s.tables.filter((t) => t.branch_id === form.branch_id).map((t) => ({ value: t.id, label: `Table ${t.number} (${t.capacity}p)` }))]} />
          </Field>
          <Field label="Special request"><input className={inputCls} value={form.special_request} onChange={(e) => setForm((f) => ({ ...f, special_request: e.target.value }))} /></Field>
          <Field label="Branch">
            <Select value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v, table_id: '' }))}
              options={[{ value: '', label: 'No branch' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
