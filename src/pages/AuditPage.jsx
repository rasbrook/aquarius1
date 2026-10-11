import { useMemo, useState } from 'react'
import { useRMS } from '../lib/rmsData'
import { PageHeader, Card, Badge, DataTable, SearchInput, useDebounce, Select } from '../components/ui'

const ACTION_COLORS = {
  create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700', cancel: 'bg-red-100 text-red-700',
  refund: 'bg-purple-100 text-purple-700', delete: 'bg-red-100 text-red-700', approve: 'bg-emerald-100 text-emerald-700',
  complete: 'bg-teal-100 text-teal-700', close: 'bg-amber-100 text-amber-700', open: 'bg-emerald-100 text-emerald-700',
  adjust: 'bg-amber-100 text-amber-700', receive: 'bg-indigo-100 text-indigo-700', redeem: 'bg-purple-100 text-purple-700',
}

export default function AuditPage() {
  const s = useRMS()
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [entity, setEntity] = useState('all')

  const entities = useMemo(() => [...new Set(s.audit_logs.map((l) => l.entity))], [s.audit_logs])
  const rows = useMemo(() => {
    let list = [...s.audit_logs]
    if (entity !== 'all') list = list.filter((l) => l.entity === entity)
    if (dq) list = list.filter((l) => (l.user + l.entity + l.entity_id + l.action).toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.audit_logs, entity, dq])

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Audit Logs" subtitle="Immutable record of important actions"
        actions={<>
          <Select value={entity} onChange={setEntity}
            options={[{ value: 'all', label: 'All entities' }, ...entities.map((e) => ({ value: e, label: e.replace('_', ' ') }))]} />
          <SearchInput value={q} onChange={setQ} placeholder="Search logs…" className="w-56" />
        </>} />

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800 mb-4">
        Audit records are append-only. Normal users cannot edit or delete them. In production this is enforced with database privileges (no UPDATE/DELETE grants).
      </div>

      <Card pad={false}>
        <DataTable columns={[
          { key: 'created_at', label: 'Timestamp', render: (l) => <span className="text-gray-500 text-xs">{new Date(l.created_at).toLocaleString()}</span> },
          { key: 'user', label: 'User', render: (l) => <span className="font-medium text-gray-800">{l.user}</span> },
          { key: 'action', label: 'Action', render: (l) => <Badge color={ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-600'}>{l.action}</Badge> },
          { key: 'entity', label: 'Entity', render: (l) => <span className="text-gray-600">{l.entity.replace('_', ' ')}</span> },
          { key: 'entity_id', label: 'Record' },
          { key: 'change', label: 'Change', render: (l) => (
            <span className="text-xs text-gray-600">
              {l.prev && <span className="line-through text-red-400 mr-1.5">{l.prev}</span>}
              {l.new && <span className="text-emerald-600">{l.new}</span>}
              {!l.prev && !l.new && '—'}
            </span>
          ) },
        ]} rows={rows} empty="No audit records" />
      </Card>
    </div>
  )
}
