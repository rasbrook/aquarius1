import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRMS, update, resetDemoData, logAudit } from '../lib/rmsData'
import { db, isDemoMode } from '../lib/supabase'
import { PageHeader, Card, Btn, Field, inputCls, Select, Tabs, Badge, toast } from '../components/ui'
import { Save, RefreshCcw, ShieldCheck } from 'lucide-react'

const ALL_PERMISSIONS = [
  'dashboard.view', 'pos.use', 'orders.create', 'orders.manage', 'kitchen.view', 'tables.view',
  'menu.edit', 'inventory.manage', 'purchasing.manage', 'expenses.view', 'expenses.manage',
  'cash.open', 'cash.close', 'cash.manage', 'reports.view', 'employees.manage',
  'customers.manage', 'promotions.manage', 'settings.view', 'settings.manage',
]

export default function SettingsPage() {
  const s = useRMS()
  const { user } = useAuth()
  const [tab, setTab] = useState('restaurant')
  const [restaurant, setRestaurant] = useState({ ...s.settings.restaurant })
  const [pos, setPos] = useState({ ...s.settings.pos })
  const [taxEdit, setTaxEdit] = useState(null)
  const [roleEdit, setRoleEdit] = useState(null)
  const [userEdit, setUserEdit] = useState(null)

  const saveRestaurantRecord = async (changes) => {
    if (!user?.id) { toast('You must be signed in to save restaurant settings', 'error'); return false }
    const { error } = await db('restaurants').update({ ...changes, updated_at: new Date().toISOString() }).eq('owner_id', user.id)
    if (error) { toast('Could not save restaurant settings', 'error'); return false }
    return true
  }

  const saveRestaurant = async () => {
    const saved = await saveRestaurantRecord({
      name: restaurant.name,
      logo: restaurant.logo,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      currency: restaurant.currency,
      timezone: restaurant.timezone,
    })
    if (!saved) return
    update((st) => { st.settings.restaurant = { ...restaurant } })
    toast('Restaurant settings saved')
  }
  const savePos = async () => {
    const nextPos = { ...pos, service_charge_pct: Number(pos.service_charge_pct), large_variance_threshold: Number(pos.large_variance_threshold) }
    if (!await saveRestaurantRecord({ pos_settings: nextPos })) return
    update((st) => { st.settings.pos = nextPos })
    toast('POS settings saved')
  }

  const saveTax = async (t) => {
    const nextTaxes = t.id
      ? s.taxes.map((tax) => tax.id === t.id ? { ...tax, ...t } : tax)
      : [...s.taxes, { ...t, id: `tax_${Math.random().toString(36).slice(2, 9)}` }]
    if (!await saveRestaurantRecord({ taxes: nextTaxes })) return
    update((st) => {
      st.taxes = nextTaxes
    })
    setTaxEdit(null)
    toast('Tax saved')
  }

  const saveRole = async (r) => {
    const rec = { ...r, permissions: r.name === 'Owner' ? ['*'] : r.permissions }
    const nextRoles = rec.id
      ? s.roles.map((role) => role.id === rec.id ? rec : role)
      : [...s.roles, { ...rec, id: `role_${Math.random().toString(36).slice(2, 9)}` }]
    if (!await saveRestaurantRecord({ roles: nextRoles })) return
    update((st) => {
      st.roles = nextRoles
      logAudit(st, { user: 'Admin', action: 'update', entity: 'role', entity_id: rec.name })
    })
    setRoleEdit(null)
    toast('Role saved')
  }

  const saveUser = async (u) => {
    const nextUsers = u.id
      ? s.users.map((user) => user.id === u.id ? u : user)
      : [...s.users, { ...u, id: `user_${Math.random().toString(36).slice(2, 9)}`, status: 'active' }]
    if (!await saveRestaurantRecord({ users: nextUsers })) return
    update((st) => {
      st.users = nextUsers
    })
    setUserEdit(null)
    toast('User saved')
  }

  const togglePerm = (perm) => setRoleEdit((r) => {
    const has = r.permissions.includes(perm)
    return { ...r, permissions: has ? r.permissions.filter((p) => p !== perm) : [...r.permissions, perm] }
  })

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Settings" subtitle="Restaurant, POS, taxes, users and roles" />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'restaurant', label: 'Restaurant' },
        { key: 'pos', label: 'POS & Receipts' },
        { key: 'taxes', label: 'Taxes' },
        { key: 'users', label: 'Users & Roles' },
        { key: 'data', label: 'Data' },
      ]} />

      {tab === 'restaurant' && (
        <Card title="Restaurant profile">
          <div className="grid grid-cols-2 gap-4 p-2">
            <Field label="Restaurant name"><input className={inputCls} value={restaurant.name} onChange={(e) => setRestaurant((r) => ({ ...r, name: e.target.value }))} /></Field>
            <Field label="Logo (emoji or URL)"><input className={inputCls} value={restaurant.logo} onChange={(e) => setRestaurant((r) => ({ ...r, logo: e.target.value }))} /></Field>
            <Field label="Address"><input className={inputCls} value={restaurant.address} onChange={(e) => setRestaurant((r) => ({ ...r, address: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} value={restaurant.phone} onChange={(e) => setRestaurant((r) => ({ ...r, phone: e.target.value }))} /></Field>
            <Field label="Email"><input className={inputCls} value={restaurant.email} onChange={(e) => setRestaurant((r) => ({ ...r, email: e.target.value }))} /></Field>
            <Field label="Currency">
              <Select value={restaurant.currency} onChange={(v) => setRestaurant((r) => ({ ...r, currency: v }))}
                options={['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AED', 'NGN', 'KES'].map((c) => ({ value: c, label: c })).concat([{ value: 'UGX', label: 'UGX - Ugandan Shilling' }])} />
            </Field>
            <Field label="Timezone"><input className={inputCls} value={restaurant.timezone} onChange={(e) => setRestaurant((r) => ({ ...r, timezone: e.target.value }))} /></Field>
          </div>
          <div className="px-4 pb-4"><Btn onClick={saveRestaurant}><Save size={15} /> Save</Btn></div>
        </Card>
      )}

      {tab === 'pos' && (
        <Card title="Point of Sale">
          <div className="grid grid-cols-2 gap-4 p-2">
            <Field label="Order number prefix"><input className={inputCls} value={pos.order_prefix} onChange={(e) => setPos((p) => ({ ...p, order_prefix: e.target.value }))} /></Field>
            <Field label="Default payment method"><Select value={pos.default_payment_method} onChange={(v) => setPos((p) => ({ ...p, default_payment_method: v }))} options={['Cash', 'Card', 'Mobile Money', 'Bank Transfer'].map((m) => ({ value: m, label: m }))} /></Field>
            <Field label="Service charge %"><input type="number" step="0.1" className={inputCls} value={pos.service_charge_pct} onChange={(e) => setPos((p) => ({ ...p, service_charge_pct: e.target.value }))} /></Field>
            <Field label="Receipt footer"><input className={inputCls} value={pos.receipt_footer} onChange={(e) => setPos((p) => ({ ...p, receipt_footer: e.target.value }))} /></Field>
            <Field label="Large cash variance threshold">
              <input type="number" className={inputCls} value={pos.large_variance_threshold} onChange={(e) => setPos((p) => ({ ...p, large_variance_threshold: e.target.value }))} />
            </Field>
            <Field label="Require open register for cash payments">
              <Select value={String(pos.require_register_for_cash)} onChange={(v) => setPos((p) => ({ ...p, require_register_for_cash: v === 'true' }))}
                options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
            </Field>
            <Field label="Allow unpaid (credit) orders">
              <Select value={String(pos.allow_credit)} onChange={(v) => setPos((p) => ({ ...p, allow_credit: v === 'true' }))}
                options={[{ value: 'false', label: 'No — payment required' }, { value: 'true', label: 'Yes' }]} />
            </Field>
          </div>
          <div className="px-4 pb-4"><Btn onClick={savePos}><Save size={15} /> Save</Btn></div>
        </Card>
      )}

      {tab === 'taxes' && (
        <Card
          title="Configurable taxes"
          actions={
            <Btn
              size="sm"
              onClick={() => setTaxEdit({ id: null, name: '', rate: 10, inclusive: false, effective_date: new Date().toISOString().slice(0, 10), branches: s.branches.map((branch) => branch.id), active: true })}
            >
              + Add tax
            </Btn>
          }
        >
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Rate</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Effective</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {s.taxes.map((t) => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{t.name}</td>
                  <td className="px-4 py-2.5">{t.rate}%</td>
                  <td className="px-4 py-2.5">{t.inclusive ? 'Tax-inclusive pricing' : 'Tax-exclusive'}</td>
                  <td className="px-4 py-2.5">{t.effective_date}</td>
                  <td className="px-4 py-2.5"><Badge color={t.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{t.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-2.5 text-right">
                    <Btn size="sm" variant="ghost" onClick={() => setTaxEdit({ ...t })}>Edit</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {taxEdit && (
            <div className="border-t border-gray-100 mt-3 pt-4 grid grid-cols-2 gap-3">
              <Field label="Tax name"><input className={inputCls} value={taxEdit.name} onChange={(e) => setTaxEdit((t) => ({ ...t, name: e.target.value }))} /></Field>
              <Field label="Rate %"><input type="number" step="0.1" className={inputCls} value={taxEdit.rate} onChange={(e) => setTaxEdit((t) => ({ ...t, rate: Number(e.target.value) }))} /></Field>
              <Field label="Pricing"><Select value={String(taxEdit.inclusive)} onChange={(v) => setTaxEdit((t) => ({ ...t, inclusive: v === 'true' }))}
                options={[{ value: 'false', label: 'Tax-exclusive (added at checkout)' }, { value: 'true', label: 'Tax-inclusive (in prices)' }]} /></Field>
              <Field label="Effective date"><input type="date" className={inputCls} value={taxEdit.effective_date} onChange={(e) => setTaxEdit((t) => ({ ...t, effective_date: e.target.value }))} /></Field>
              <Field label="Status"><Select value={String(taxEdit.active)} onChange={(v) => setTaxEdit((t) => ({ ...t, active: v === 'true' }))}
                options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} /></Field>
              <div className="flex items-end gap-2">
                <Btn onClick={() => saveTax(taxEdit)}>Save tax</Btn>
                <Btn variant="secondary" onClick={() => setTaxEdit(null)}>Cancel</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'users' && (
        <div className="space-y-5">
          <Card
            title="Users"
            actions={
              <Btn
                size="sm"
                onClick={() => setUserEdit({ id: null, name: '', email: '', role_id: s.roles[0]?.id, branch_ids: s.branches[0] ? [s.branches[0].id] : [], status: 'active' })}
              >
                + Add user
              </Btn>
            }
          >
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Branches</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {s.users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                    <td className="px-4 py-2.5"><Badge color="bg-blue-50 text-blue-700">{s.roles.find((r) => r.id === u.role_id)?.name}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{(u.branch_ids || []).map((b) => s.branches.find((x) => x.id === b)?.name).filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-2.5"><Badge color={u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}>{u.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right"><Btn size="sm" variant="ghost" onClick={() => setUserEdit({ ...u })}>Edit</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {userEdit && (
              <div className="border-t border-gray-100 mt-3 pt-4 grid grid-cols-2 gap-3">
                <Field label="Name"><input className={inputCls} value={userEdit.name} onChange={(e) => setUserEdit((u) => ({ ...u, name: e.target.value }))} /></Field>
                <Field label="Email"><input className={inputCls} value={userEdit.email} onChange={(e) => setUserEdit((u) => ({ ...u, email: e.target.value }))} /></Field>
                <Field label="Role"><Select value={userEdit.role_id} onChange={(v) => setUserEdit((u) => ({ ...u, role_id: v }))}
                  options={s.roles.map((r) => ({ value: r.id, label: r.name }))} /></Field>
                <Field label="Status"><Select value={userEdit.status} onChange={(v) => setUserEdit((u) => ({ ...u, status: v }))}
                  options={[{ value: 'active', label: 'Active' }, { value: 'invited', label: 'Invited' }, { value: 'disabled', label: 'Disabled' }]} /></Field>
                <Field label="Branches"><Select value={userEdit.branch_ids[0] || ''} onChange={(v) => setUserEdit((u) => ({ ...u, branch_ids: v ? [v] : [] }))}
                  options={[{ value: '', label: 'No branch' }, ...s.branches.map((b) => ({ value: b.id, label: b.name }))]} /></Field>
                <div className="flex items-end gap-2">
                  <Btn onClick={() => saveUser(userEdit)}>Save user</Btn>
                  <Btn variant="secondary" onClick={() => setUserEdit(null)}>Cancel</Btn>
                </div>
              </div>
            )}
          </Card>

          <Card title="Roles & permissions" actions={<span className="text-xs text-gray-400 flex items-center gap-1"><ShieldCheck size={13} /> enforced via RLS in production</span>}>
            <div className="space-y-2 p-2">
              {s.roles.map((r) => (
                <div key={r.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.permissions.includes('*') ? 'All permissions' : `${r.permissions.length} permissions`}</p>
                  </div>
                  <Btn size="sm" variant="secondary" onClick={() => setRoleEdit({ ...r, permissions: [...r.permissions] })}>Edit permissions</Btn>
                </div>
              ))}
            </div>
            {roleEdit && (
              <div className="border-t border-gray-100 mt-3 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Field label="Role name"><input className={inputCls} value={roleEdit.name} onChange={(e) => setRoleEdit((r) => ({ ...r, name: e.target.value }))} disabled={roleEdit.name === 'Owner'} /></Field>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p} className={`flex items-center gap-2 text-sm rounded-lg border p-2 cursor-pointer ${roleEdit.permissions.includes(p) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                      <input type="checkbox" checked={roleEdit.permissions.includes(p) || roleEdit.permissions.includes('*')} disabled={roleEdit.permissions.includes('*')}
                        onChange={() => togglePerm(p)} className="accent-emerald-600" />
                      <span className="text-gray-700">{p}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Btn onClick={() => saveRole(roleEdit)}>Save role</Btn>
                  <Btn variant="secondary" onClick={() => setRoleEdit(null)}>Cancel</Btn>
                </div>
              </div>
            )}
          </Card>
        </div >
      )
      }

      {
        tab === 'data' && (
          <Card title={isDemoMode ? 'Demo data' : 'Database sync'}>
            <div className="p-4 space-y-3">
              {isDemoMode ? (
                <>
                  <p className="text-sm text-gray-600">Reset local demo records stored in this browser. Restaurant profile and settings saved in the database are not removed by this action.</p>
                  <Btn variant="danger" onClick={() => { resetDemoData(); toast('Demo data reset'); window.location.reload() }}><RefreshCcw size={15} /> Reset demo data</Btn>
                  <p className="text-xs text-gray-400">To connect a real backend, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env file and apply supabase/schema.sql. Never commit service-role keys.</p>
                </>
              ) : (
                <p className="text-sm text-gray-600">Restaurant operations data is loaded from your database and saved automatically after changes, with a periodic save every three minutes.</p>
              )}
            </div>
          </Card>
        )
      }
    </div >
  )
}
