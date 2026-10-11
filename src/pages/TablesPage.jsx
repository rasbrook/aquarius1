import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRMS, update, TABLE_STATUS_COLORS, logAudit } from '../lib/rmsData'
import { PageHeader, Card, Btn, Modal, Field, inputCls, Select, useCurrency, toast } from '../components/ui'
import { Plus, Users } from 'lucide-react'

const STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'out_of_service']
const STATUS_LABELS = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', cleaning: 'Cleaning', out_of_service: 'Out of service' }

export default function TablesPage() {
  const navigate = useNavigate()
  const s = useRMS()
  const cur = useCurrency()
  const [branchId, setBranchId] = useState('')
  const [selected, setSelected] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newTable, setNewTable] = useState({ number: '', capacity: 2, branch_id: '', section_id: '' })
  const [mergeSource, setMergeSource] = useState(null)

  const activeBranchId = s.branches.some((branch) => branch.id === branchId) ? branchId : s.branches[0]?.id || ''
  const sections = s.sections.filter((x) => x.branch_id === activeBranchId)
  const tables = activeBranchId
    ? s.tables.filter((x) => x.branch_id === activeBranchId || !x.branch_id)
    : s.tables.filter((x) => !x.branch_id)
  const unassignedTables = tables.filter((table) => !sections.some((section) => section.id === table.section_id))
  const formBranchId = s.branches.some((branch) => branch.id === newTable.branch_id) ? newTable.branch_id : ''
  const formSections = s.sections.filter((section) => section.branch_id === formBranchId)
  const orderOf = (t) => s.orders.find((o) => o.id === t.current_order_id)

  const setStatus = (t, status) => {
    update((st) => {
      const tbl = st.tables.find((x) => x.id === t.id)
      tbl.status = status
      if (status !== 'occupied') tbl.current_order_id = null
      logAudit(st, { user: 'Manager', action: 'update', entity: 'table', entity_id: `Table ${t.number}`, prev: t.status, new: status })
    })
    setSelected(null)
    toast(`Table ${t.number} marked ${STATUS_LABELS[status]}`)
  }

  const moveOrder = (fromTable, toTable) => {
    update((st) => {
      const from = st.tables.find((x) => x.id === fromTable.id)
      const to = st.tables.find((x) => x.id === toTable.id)
      const order = st.orders.find((o) => o.id === from.current_order_id)
      if (order) order.table_id = to.id
      to.current_order_id = from.current_order_id
      to.status = 'occupied'
      from.current_order_id = null
      from.status = 'available'
      logAudit(st, { user: 'Manager', action: 'transfer', entity: 'table', entity_id: `Table ${from.number} → ${to.number}` })
    })
    setSelected(null)
    toast(`Order moved to table ${toTable.number}`)
  }

  const addTable = () => {
    if (!newTable.number) { toast('Enter a table number', 'error'); return }
    update((st) => {
      st.tables.push({
        id: `tbl_${Math.random().toString(36).slice(2, 9)}`, branch_id: formBranchId || null,
        section_id: newTable.section_id || null, number: Number(newTable.number),
        capacity: Number(newTable.capacity), status: 'available', current_order_id: null,
        x: 20 + (tables.length % 3) * 180, y: 20 + Math.floor(tables.length / 3) * 140,
      })
    })
    setAddOpen(false)
    setNewTable({ number: '', capacity: 2, branch_id: '', section_id: '' })
    toast('Table added')
  }

  return (
    <div>
      <PageHeader title="Table Management" subtitle="Visual floor plan and table status"
        actions={<>
          <Select value={activeBranchId} onChange={setBranchId} className="!w-auto min-w-40"
            options={s.branches.length
              ? s.branches.map((b) => ({ value: b.id, label: b.name }))
              : [{ value: '', label: 'No branches configured', disabled: true }]} />
          <Btn onClick={() => { setNewTable({ number: '', capacity: 2, branch_id: activeBranchId, section_id: '' }); setAddOpen(true) }}><Plus size={16} /> Add Table</Btn>
        </>} />

      {!s.branches.length && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">No branches configured</h2>
              <p className="mt-1 text-sm text-gray-500">Tables can be created without a branch or section and assigned later.</p>
            </div>
            <Btn variant="secondary" onClick={() => navigate('/branches')}><Plus size={15} /> Create branch</Btn>
          </div>
        </Card>
      )}

      {!!s.branches.length && !sections.length && (
        <Card className="mb-6">
          <p className="p-4 text-sm text-gray-500">No sections exist for this branch yet. You can add tables now and assign them once a section is available.</p>
        </Card>
      )}

      {sections.map((sec) => (
        <Card key={sec.id} title={`${sec.name} · ${tables.filter((t) => t.section_id === sec.id).length} tables`} className="mb-6">
          <div className="flex flex-wrap gap-4 p-4">
            {tables.filter((t) => t.section_id === sec.id).map((t) => {
              const order = orderOf(t)
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`relative w-36 h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-md ${TABLE_STATUS_COLORS[t.status]}`}>
                  <span className="text-2xl font-bold">T{t.number}</span>
                  <span className="text-xs flex items-center gap-1"><Users size={11} /> {t.capacity} seats</span>
                  {order && <span className="text-xs font-semibold">{cur(order.total)}</span>}
                  {order && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{order.number.slice(-3)}</span>}
                </button>
              )
            })}
          </div>
        </Card>
      ))}

      {unassignedTables.length > 0 && (
        <Card title={`Unassigned tables · ${unassignedTables.length} tables`} className="mb-6">
          <div className="flex flex-wrap gap-4 p-4">
            {unassignedTables.map((t) => {
              const order = orderOf(t)
              return (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`relative w-36 h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-md ${TABLE_STATUS_COLORS[t.status]}`}>
                  <span className="text-2xl font-bold">T{t.number}</span>
                  <span className="text-xs flex items-center gap-1"><Users size={11} /> {t.capacity} seats</span>
                  {order && <span className="text-xs font-semibold">{cur(order.total)}</span>}
                  {order && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{order.number.slice(-3)}</span>}
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Table detail / actions */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Table ${selected.number}` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm text-center">
              <div className="bg-gray-50 rounded-lg p-2.5"><p className="text-xs text-gray-400">Section</p><p className="font-medium">{sections.find((x) => x.id === selected.section_id)?.name}</p></div>
              <div className="bg-gray-50 rounded-lg p-2.5"><p className="text-xs text-gray-400">Capacity</p><p className="font-medium">{selected.capacity} guests</p></div>
              <div className="bg-gray-50 rounded-lg p-2.5"><p className="text-xs text-gray-400">Status</p><p className="font-medium capitalize">{selected.status.replace('_', ' ')}</p></div>
            </div>
            {orderOf(selected) && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Current order</p>
                <p className="text-sm font-medium">{orderOf(selected).number} · {cur(orderOf(selected).total)}</p>
                <p className="text-xs text-gray-500">{orderOf(selected).items.map((i) => `${i.qty}x ${i.name}`).join(', ')}</p>
              </div>
            )}
            <Field label="Change status">
              <div className="flex gap-1.5 flex-wrap">
                {STATUSES.map((st) => (
                  <Btn key={st} size="sm" variant={selected.status === st ? 'primary' : 'secondary'} className="capitalize" onClick={() => setStatus(selected, st)}>
                    {STATUS_LABELS[st]}
                  </Btn>
                ))}
              </div>
            </Field>
            {orderOf(selected) && (
              <Field label="Transfer order to table">
                <div className="flex gap-1.5 flex-wrap">
                  {tables.filter((t) => t.id !== selected.id && t.status === 'available').map((t) => (
                    <Btn key={t.id} size="sm" variant="secondary" onClick={() => moveOrder(selected, t)}>T{t.number}</Btn>
                  ))}
                </div>
              </Field>
            )}
            {mergeSource ? (
              <Field label={`Merge table ${mergeSource.number} into…`}>
                <div className="flex gap-1.5 flex-wrap">
                  {tables.filter((t) => t.id !== mergeSource.id).map((t) => (
                    <Btn key={t.id} size="sm" variant="warn" onClick={() => {
                      update((st) => {
                        const a = st.tables.find((x) => x.id === mergeSource.id)
                        const b = st.tables.find((x) => x.id === t.id)
                        if (b.current_order_id && a.current_order_id) {
                          const ob = st.orders.find((o) => o.id === b.current_order_id)
                          const oa = st.orders.find((o) => o.id === a.current_order_id)
                          ob.items = [...ob.items, ...oa.items]
                          ob.subtotal = Math.round((ob.subtotal + oa.subtotal) * 100) / 100
                          ob.tax = Math.round((ob.tax + oa.tax) * 100) / 100
                          ob.total = Math.round((ob.total + oa.total) * 100) / 100
                          oa.status = 'cancelled'
                          oa.notes = `Merged into ${ob.number}`
                        } else if (a.current_order_id) {
                          b.current_order_id = a.current_order_id
                          b.status = 'occupied'
                          const oa = st.orders.find((o) => o.id === a.current_order_id)
                          if (oa) oa.table_id = b.id
                        }
                        a.status = 'available'
                        a.current_order_id = null
                        logAudit(st, { user: 'Manager', action: 'merge', entity: 'table', entity_id: `Table ${mergeSource.number} → ${t.number}` })
                      })
                      setMergeSource(null); setSelected(null)
                      toast('Tables merged')
                    }}>T{t.number}</Btn>
                  ))}
                </div>
              </Field>
            ) : (
              <Btn variant="secondary" size="sm" onClick={() => setMergeSource(selected)}>Merge this table…</Btn>
            )}
          </div>
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add table"
        footer={<><Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn><Btn onClick={addTable}>Add table</Btn></>}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Table number"><input className={inputCls} value={newTable.number} onChange={(e) => setNewTable((t) => ({ ...t, number: e.target.value }))} /></Field>
          <Field label="Capacity"><input type="number" min="1" className={inputCls} value={newTable.capacity} onChange={(e) => setNewTable((t) => ({ ...t, capacity: e.target.value }))} /></Field>
          {s.branches.length > 0 && (
            <Field label="Branch">
              <Select value={formBranchId} onChange={(v) => setNewTable((t) => ({ ...t, branch_id: v, section_id: '' }))}
                options={[{ value: '', label: 'No branch' }, ...s.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
            </Field>
          )}
          <Field label="Section (optional)">
            <Select value={newTable.section_id} onChange={(v) => setNewTable((t) => ({ ...t, section_id: v }))}
              options={[{ value: '', label: formSections.length ? 'Unassigned' : 'No sections available' }, ...formSections.map((section) => ({ value: section.id, label: section.name }))]} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
