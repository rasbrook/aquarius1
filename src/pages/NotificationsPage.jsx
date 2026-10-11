import { useMemo, useState } from 'react'
import { useRMS, update } from '../lib/rmsData'
import { PageHeader, Card, Badge, Btn, DataTable, Select } from '../components/ui'
import { Bell, BellOff } from 'lucide-react'

const TYPE_COLORS = {
  low_stock: 'bg-amber-100 text-amber-700', order: 'bg-blue-100 text-blue-700', expense: 'bg-orange-100 text-orange-700',
  po: 'bg-indigo-100 text-indigo-700', cash_variance: 'bg-red-100 text-red-700', reservation: 'bg-purple-100 text-purple-700',
}

export default function NotificationsPage() {
  const s = useRMS()
  const [filter, setFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const types = useMemo(() => [...new Set(s.notifications.map((n) => n.type))], [s.notifications])
  const rows = useMemo(() => {
    let list = [...s.notifications]
    if (filter === 'unread') list = list.filter((n) => !n.read)
    if (typeFilter !== 'all') list = list.filter((n) => n.type === typeFilter)
    return list
  }, [s.notifications, filter, typeFilter])

  const unread = s.notifications.filter((n) => !n.read).length

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Notification Center" subtitle={`${unread} unread of ${s.notifications.length}`}
        actions={<>
          <Select value={typeFilter} onChange={setTypeFilter}
            options={[{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t.replace('_', ' ') }))]} />
          <div className="flex gap-1">
            {[['all', 'All'], ['unread', 'Unread']].map(([v, l]) => (
              <Btn key={v} size="sm" variant={filter === v ? 'primary' : 'secondary'} onClick={() => setFilter(v)}>{l}</Btn>
            ))}
          </div>
          <Btn variant="secondary" size="sm" onClick={() => update((st) => { st.notifications.forEach((n) => { n.read = true }) })}>Mark all read</Btn>
          <Btn variant="danger" size="sm" onClick={() => update((st) => { st.notifications = [] })}>Clear</Btn>
        </>} />

      <Card pad={false}>
        <DataTable columns={[
          { key: 'read', label: '', render: (n) => n.read ? <BellOff size={14} className="text-gray-300" /> : <Bell size={14} className="text-emerald-600" /> },
          { key: 'type', label: 'Type', render: (n) => <Badge color={TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-600'}>{n.type.replace('_', ' ')}</Badge> },
          { key: 'message', label: 'Message', render: (n) => <span className={n.read ? 'text-gray-500' : 'text-gray-800 font-medium'}>{n.message}</span> },
          { key: 'created_at', label: 'When', render: (n) => <span className="text-gray-400 text-xs">{new Date(n.created_at).toLocaleString()}</span> },
          { key: 'actions', label: '', render: (n) => !n.read && <Btn size="sm" variant="ghost" onClick={() => update((st) => { st.notifications.find((x) => x.id === n.id).read = true })}>Mark read</Btn> },
        ]} rows={rows} empty="No notifications" />
      </Card>
    </div>
  )
}
