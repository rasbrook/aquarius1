import { useMemo, useState } from 'react'
import { useRMS, update, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, Modal, Field, inputCls, Select, DataTable, useCurrency, toast, Tabs, Stat } from '../components/ui'
import { Plus, Clock3, Clock, LogOut } from 'lucide-react'
import { format } from 'date-fns'

const DEPARTMENTS = ['Management', 'Front of House', 'Kitchen', 'Finance', 'Inventory', 'Cleaning', 'Delivery']

export default function EmployeesPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [tab, setTab] = useState('employees')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(null)
  const [attDate, setAttDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const openEdit = (e) => { setForm(e ? { ...e } : { id: null, name: '', employee_no: `E${String(s.employees.length + 1).padStart(3, '0')}`, phone: '', email: '', role: 'Waiter', department: 'Front of House', branch_id: s.branches[0]?.id || '', hire_date: format(new Date(), 'yyyy-MM-dd'), salary: 2000, status: 'active' }); setEditOpen(true) }

  const save = () => {
    if (!form.name) { toast('Name required', 'error'); return }
    update((st) => {
      if (form.id) Object.assign(st.employees.find((x) => x.id === form.id), form)
      else st.employees.push({ ...form, id: `emp_${Math.random().toString(36).slice(2, 9)}` })
      logAudit(st, { user: 'HR', action: form.id ? 'update' : 'create', entity: 'employee', entity_id: form.name })
    })
    setEditOpen(false)
    toast('Employee saved')
  }

  const dayAttendance = s.attendance.filter((a) => a.date === attDate)
  const onLeave = s.employees.filter((e) => e.status !== 'active').length
  const monthlyPayroll = s.employees.filter((e) => e.status === 'active').reduce((sum, e) => sum + e.salary, 0)

  const punch = (employeeId, kind) => {
    update((st) => {
      let rec = st.attendance.find((a) => a.employee_id === employeeId && a.date === attDate)
      const now = new Date().toISOString()
      if (!rec) {
        rec = { id: `att_${Math.random().toString(36).slice(2, 9)}`, employee_id: employeeId, date: attDate, clock_in: null, clock_out: null, breaks: [], status: 'present' }
        st.attendance.push(rec)
      }
      if (kind === 'in' && !rec.clock_in) { rec.clock_in = now; if (new Date().getHours() >= 9 && new Date().getMinutes() > 5) rec.status = 'late' }
      if (kind === 'out' && rec.clock_in && !rec.clock_out) rec.clock_out = now
      if (kind === 'break_start') rec.breaks.push({ start: now, end: null })
      if (kind === 'break_end') { const b = [...rec.breaks].reverse().find((x) => !x.end); if (b) b.end = now }
      logAudit(st, { user: 'HR', action: kind, entity: 'attendance', entity_id: st.employees.find((e) => e.id === employeeId)?.name })
    })
    toast('Punch recorded')
  }

  const hoursOf = (a) => {
    if (!a.clock_in) return 0
    const end = a.clock_out ? new Date(a.clock_out) : new Date()
    let ms = end - new Date(a.clock_in)
    a.breaks.forEach((b) => { if (b.end) ms -= new Date(b.end) - new Date(b.start) })
    return Math.max(0, ms / 3600000)
  }

  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff, attendance and payroll"
        actions={<Btn onClick={() => openEdit(null)}><Plus size={15} /> New Employee</Btn>} />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'employees', label: 'Employees' },
        { key: 'attendance', label: 'Attendance' },
      ]} />

      {tab === 'employees' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Active staff" value={s.employees.filter((e) => e.status === 'active').length} />
            <Stat label="Departments" value={new Set(s.employees.map((e) => e.department)).size} />
            <Stat label="Monthly payroll" value={cur(monthlyPayroll)} />
            <Stat label="On leave / inactive" value={onLeave} />
          </div>
          <Card pad={false}>
            <DataTable columns={[
              { key: 'name', label: 'Employee', render: (e) => <div><p className="font-medium text-gray-800">{e.name}</p><p className="text-xs text-gray-400">{e.employee_no} · since {e.hire_date}</p></div> },
              { key: 'role', label: 'Role', render: (e) => <Badge color="bg-blue-50 text-blue-700">{e.role}</Badge> },
              { key: 'department', label: 'Department' },
              { key: 'branch_id', label: 'Branch', render: (e) => s.branches.find((b) => b.id === e.branch_id)?.name },
              { key: 'phone', label: 'Phone' },
              { key: 'salary', label: 'Salary / month', render: (e) => cur(e.salary) },
              { key: 'status', label: 'Status', render: (e) => <Badge color={e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{e.status}</Badge> },
              { key: 'actions', label: '', render: (e) => <Btn size="sm" variant="ghost" onClick={() => openEdit(e)}>Edit</Btn> },
            ]} rows={s.employees} />
          </Card>
        </>
      )}

      {tab === 'attendance' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <input type="date" className={inputCls + ' w-44'} value={attDate} onChange={(e) => setAttDate(e.target.value)} />
            <p className="text-sm text-gray-500">{dayAttendance.length} of {s.employees.length} staff clocked in</p>
          </div>
          <Card pad={false}>
            <DataTable columns={[
              { key: 'employee', label: 'Employee', render: (a) => { const e = s.employees.find((x) => x.id === a.employee_id); return <span className="font-medium text-gray-800">{e?.name}</span> } },
              { key: 'status', label: 'Status', render: (a) => <Badge color={a.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>{a.status || 'present'}</Badge> },
              { key: 'clock_in', label: 'Clock in', render: (a) => a.clock_in ? new Date(a.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
              { key: 'clock_out', label: 'Clock out', render: (a) => a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' },
              { key: 'breaks', label: 'Breaks', render: (a) => a.breaks.length ? `${a.breaks.length}×` : '—' },
              { key: 'hours', label: 'Hours', render: (a) => <span className="font-semibold">{hoursOf(a).toFixed(2)}h</span> },
            ]} rows={dayAttendance.sort((a, b) => (a.clock_in || '').localeCompare(b.clock_in || ''))} empty="No punches for this date" />
          </Card>
          <Card title="Quick punch" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-2">
              {s.employees.filter((e) => e.status === 'active').map((e) => {
                const a = dayAttendance.find((x) => x.employee_id === e.id)
                return (
                  <div key={e.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{e.name}</p>
                      <p className="text-xs text-gray-400">{a ? `${hoursOf(a).toFixed(1)}h today` : 'Not clocked in'}</p>
                    </div>
                    <div className="flex gap-1">
                      {!a?.clock_in && <Btn size="sm" onClick={() => punch(e.id, 'in')}><Clock size={12} /> In</Btn>}
                      {a?.clock_in && !a?.clock_out && (
                        <>
                          <Btn size="sm" variant="secondary" onClick={() => punch(e.id, a.breaks.some((b) => !b.end) ? 'break_end' : 'break_start')}>{a.breaks.some((b) => !b.end) ? 'End break' : 'Break'}</Btn>
                          <Btn size="sm" variant="danger" onClick={() => punch(e.id, 'out')}><LogOut size={12} /> Out</Btn>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={form?.id ? `Edit ${form.name}` : 'New employee'}
        footer={<><Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn><Btn onClick={save}>Save employee</Btn></>}>
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Employee ID"><input className={inputCls} value={form.employee_no} onChange={(e) => setForm((f) => ({ ...f, employee_no: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Role"><input className={inputCls} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} /></Field>
            <Field label="Department"><Select value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} /></Field>
            <Field label="Branch"><Select value={form.branch_id} onChange={(v) => setForm((f) => ({ ...f, branch_id: v }))} options={[{ value: '', label: 'No branch' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} /></Field>
            <Field label="Hire date"><input type="date" className={inputCls} value={form.hire_date} onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} /></Field>
            <Field label="Monthly salary"><input type="number" className={inputCls} value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: Number(e.target.value) }))} /></Field>
            <Field label="Status"><Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={[{ value: 'active', label: 'Active' }, { value: 'on_leave', label: 'On leave' }, { value: 'inactive', label: 'Inactive' }]} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
