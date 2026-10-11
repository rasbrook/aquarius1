import { useMemo, useState } from 'react'
import {
  useRMS, update, computeTotals, nextNumber, completeOrder, notify, logAudit,
  cancelOrder, ORDER_TYPE_LABELS,
} from '../lib/rmsData'
import { Btn, Modal, Field, inputCls, Select, toast, SearchInput, useDebounce, useCurrency } from '../components/ui'
import { Plus, Minus, Trash2, Pause, RotateCcw, Printer, ChefHat, X, Tag, User } from 'lucide-react'

const TYPES = ['dine_in', 'takeaway', 'delivery', 'pickup']
const METHODS = ['Cash', 'Card', 'Mobile Money', 'Bank Transfer']

function emptyCart() {
  return { items: [], type: 'dine_in', table_id: '', customer_id: '', waiter_id: '', notes: '', discount_code: '', discount: 0, editingId: null }
}

export default function PosPage() {
  const s = useRMS()
  const cur = useCurrency()
  const [cart, setCart] = useState(emptyCart)
  const [catFilter, setCatFilter] = useState('all')
  const [q, setQ] = useState('')
  const dq = useDebounce(q)
  const [payOpen, setPayOpen] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState(null)
  const [modifierTarget, setModifierTarget] = useState(null)
  const [heldOpen, setHeldOpen] = useState(false)
  const [payForm, setPayForm] = useState({ method: 'Cash', amount: '', method2: '', amount2: '', tip: 0 })

  const products = useMemo(() => {
    let list = s.products.filter((p) => p.available)
    if (catFilter !== 'all') list = list.filter((p) => p.category_id === catFilter)
    if (dq) list = list.filter((p) => p.name.toLowerCase().includes(dq.toLowerCase()) || p.sku.toLowerCase().includes(dq.toLowerCase()))
    return list
  }, [s.products, catFilter, dq])

  const totals = computeTotals(s, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code })
  const paymentOrder = s.orders.find((order) => order.id === paymentOrderId)
  const paymentOrderDue = paymentOrder
    ? Math.max(0, Number(paymentOrder.total || 0) + Number(paymentOrder.tip || 0) - (paymentOrder.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0))
    : totals.total
  const openSession = s.register_sessions.find((x) => x.status === 'open')
  const heldOrders = s.orders.filter((o) => o.held && o.status !== 'completed' && o.status !== 'cancelled')
  const readyForPayment = s.orders
    .filter((order) => ['ready', 'served'].includes(order.status) && ['unpaid', 'partially_paid'].includes(order.payment_status))
    .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))

  // ---------- cart ops ----------
  const addProduct = (p) => {
    const groups = (s.product_modifiers[p.id] || []).map((g) => s.modifier_groups.find((x) => x.id === g)).filter(Boolean)
    if (groups.length) { setModifierTarget({ product: p, groups, selected: {} }); return }
    pushItem(p, [])
  }
  const pushItem = (p, modifiers) => {
    setCart((c) => {
      const key = p.id + modifiers.map((m) => m.name).sort().join('|')
      const existing = c.items.find((i) => i.key === key)
      if (existing) {
        return { ...c, items: c.items.map((i) => (i.key === key ? { ...i, qty: i.qty + 1 } : i)) }
      }
      return { ...c, items: [...c.items, { key, product_id: p.id, name: p.name, price: p.price, qty: 1, modifiers, notes: '' }] }
    })
  }
  const changeQty = (key, delta) =>
    setCart((c) => ({ ...c, items: c.items.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)) }))
  const removeItem = (key) => setCart((c) => ({ ...c, items: c.items.filter((i) => i.key !== key) }))
  const voidItem = (key) => removeItem(key)
  const setItemNote = (key, notes) => setCart((c) => ({ ...c, items: c.items.map((i) => (i.key === key ? { ...i, notes } : i)) }))

  // ---------- coupons ----------
  const applyCoupon = (code) => {
    const promo = s.promotions.find((p) => p.active && p.code.toLowerCase() === code.toLowerCase())
    const now = Date.now()
    if (!promo) { toast('Invalid coupon code', 'error'); return }
    if (new Date(promo.start) > now || new Date(promo.end) < now) { toast('Coupon expired or not started', 'error'); return }
    const t = computeTotals(s, { items: cart.items })
    let discount = 0
    if (promo.scope === 'order') discount = promo.type === 'percentage' ? (t.subtotal * promo.value) / 100 : promo.value
    if (promo.scope === 'category') {
      const sub = cart.items.filter((i) => promo.category_ids.includes(s.products.find((p) => p.id === i.product_id)?.category_id)).reduce((sum, i) => sum + i.price * i.qty, 0)
      discount = promo.type === 'percentage' ? (sub * promo.value) / 100 : promo.value
    }
    if (promo.scope === 'product') {
      const sub = cart.items.filter((i) => promo.product_ids.includes(i.product_id)).reduce((sum, i) => sum + i.price * i.qty, 0)
      discount = promo.type === 'percentage' ? (sub * promo.value) / 100 : promo.value
    }
    setCart((c) => ({ ...c, discount_code: promo.code, discount: Math.round(discount * 100) / 100 }))
    toast(`Coupon ${promo.code} applied: −${cur(discount)}`)
  }

  // ---------- order actions ----------
  const validate = () => {
    if (!cart.items.length) { toast('Add at least one item', 'error'); return false }
    if (cart.type === 'dine_in' && !cart.table_id) { toast('Select a table for dine-in orders', 'error'); return false }
    return true
  }

  const sendToKitchen = (alsoPay = false) => {
    if (!validate()) return
    update((st) => {
      let order
      if (cart.editingId) {
        order = st.orders.find((o) => o.id === cart.editingId)
        Object.assign(order, {
          items: cart.items, type: cart.type, branch_id: st.tables.find((table) => table.id === cart.table_id)?.branch_id || st.branches[0]?.id || null, table_id: cart.table_id || null,
          customer_id: cart.customer_id || null, waiter_id: cart.waiter_id || null,
          notes: cart.notes, ...computeTotals(st, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code }),
        })
      } else {
        order = {
          id: `ord_${Math.random().toString(36).slice(2, 9)}`,
          number: nextNumber(st, 'order'), branch_id: st.tables.find((table) => table.id === cart.table_id)?.branch_id || st.branches[0]?.id || null,
          table_id: cart.table_id || null, customer_id: cart.customer_id || null,
          waiter_id: cart.waiter_id || null, type: cart.type, status: 'new',
          payment_status: 'unpaid', held: false, items: cart.items, notes: cart.notes,
          created_at: new Date().toISOString(), tip: 0, payments: [], completed_at: null, completed_by: '', source: 'pos',
          ...computeTotals(st, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code }),
        }
        st.orders.push(order)
      }
      if (cart.type === 'dine_in' && cart.table_id) {
        const t = st.tables.find((x) => x.id === cart.table_id)
        if (t) { t.status = 'occupied'; t.current_order_id = order.id }
      }
      notify(st, 'order', `New order ${order.number} sent to kitchen`)
      logAudit(st, { user: 'POS', action: 'create', entity: 'order', entity_id: order.number, new: `${order.items.length} items, ${cur(order.total)}` })
      return order
    })
    if (!alsoPay) { setCart(emptyCart()); toast('Order sent to kitchen') }
  }

  const holdOrder = () => {
    if (!validate()) return
    update((st) => {
      const order = {
        id: `ord_${Math.random().toString(36).slice(2, 9)}`,
        number: nextNumber(st, 'order'), branch_id: st.tables.find((table) => table.id === cart.table_id)?.branch_id || st.branches[0]?.id || null,
        table_id: cart.table_id || null, customer_id: cart.customer_id || null,
        waiter_id: cart.waiter_id || null, type: cart.type, status: 'held',
        payment_status: 'unpaid', held: true, items: cart.items, notes: cart.notes,
        created_at: new Date().toISOString(), tip: 0, payments: [], completed_at: null, completed_by: '', source: 'pos',
        ...computeTotals(st, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code }),
      }
      st.orders.push(order)
    })
    setCart(emptyCart())
    toast('Order held')
  }

  const resumeOrder = (o) => {
    setCart({ items: o.items.map((item, index) => ({ ...item, key: item.key || `${item.product_id || item.name}-${index}`, modifiers: item.modifiers || [], notes: item.notes || '' })), type: o.type, table_id: o.table_id || '', customer_id: o.customer_id || '', waiter_id: o.waiter_id || '', notes: o.notes || '', discount_code: o.discount_code || '', discount: o.discount || 0, editingId: o.id })
    setHeldOpen(false)
    update((st) => { st.orders = st.orders.filter((x) => x.id !== o.id) })
  }

  const openReadyOrderPayment = (order) => {
    setPaymentOrderId(order.id)
    setPayForm({ method: 'Cash', amount: '', method2: '', amount2: '', tip: 0 })
    setPayOpen(true)
  }

  const cancelHeld = (o) => { update((st) => cancelOrder(st, o.id, { user: 'POS' })); toast('Order cancelled') }

  const openPayment = () => {
    if (!validate()) return
    if (cart.discount > 0 && !cart.discount_code) { /* manual discount allowed */ }
    setPaymentOrderId(null)
    setPayForm({ method: 'Cash', amount: '', method2: '', amount2: '', tip: 0 })
    setPayOpen(true)
  }

  const processPayment = () => {
    const targetOrder = paymentOrderId ? s.orders.find((order) => order.id === paymentOrderId) : null
    if (paymentOrderId && (!targetOrder || !['ready', 'served'].includes(targetOrder.status) || !['unpaid', 'partially_paid'].includes(targetOrder.payment_status))) {
      toast('This order is no longer awaiting payment', 'error')
      setPayOpen(false)
      setPaymentOrderId(null)
      return
    }
    const t = targetOrder ? { total: paymentOrderDue } : computeTotals(s, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code })
    const tip = Number(payForm.tip || 0)
    const total = t.total + tip
    const payments = []
    const enteredFirst = payForm.amount === '' ? total : Number(payForm.amount)
    if (!Number.isFinite(enteredFirst) || enteredFirst < 0) { toast('Enter a valid payment amount', 'error'); return }
    const firstAmount = Math.min(enteredFirst, total)
    if (firstAmount > 0) {
      if (payForm.method === 'Cash' && s.settings.pos.require_register_for_cash && !openSession) {
        toast('Cash register must be opened before accepting cash', 'error'); return
      }
      payments.push({ method: payForm.method, amount: firstAmount, reference: `PAY-${Date.now().toString().slice(-6)}` })
    }
    const remaining = Math.round((total - firstAmount) * 100) / 100
    if (remaining > 0.009) {
      const secondAmount = Number(payForm.amount2)
      if (!payForm.method2 || !payForm.amount2 || !Number.isFinite(secondAmount) || secondAmount < remaining) {
        toast(`Remaining balance: ${cur(remaining)} — enter enough for the second payment`, 'error'); return
      }
      if (payForm.method2 === 'Cash' && s.settings.pos.require_register_for_cash && !openSession) {
        toast('Cash register must be opened before accepting cash', 'error'); return
      }
      payments.push({ method: payForm.method2, amount: remaining, reference: `PAY-${Date.now().toString().slice(-6)}S` })
    }
    // finalize: send to kitchen if new, mark paid, complete
    const result = update((st) => {
      if (paymentOrderId) {
        const order = st.orders.find((item) => item.id === paymentOrderId)
        if (!order || !['ready', 'served'].includes(order.status) || !['unpaid', 'partially_paid'].includes(order.payment_status)) {
          return { error: 'This order is no longer awaiting payment' }
        }
        order.tip = (Number(order.tip) || 0) + tip
        order.payments = [...(order.payments || []), ...payments]
        order.payment_status = 'paid'
        const completion = completeOrder(st, order, { user: 'POS' })
        return completion.error ? completion : order
      }

      let order
      if (cart.editingId) {
        order = st.orders.find((o) => o.id === cart.editingId)
        Object.assign(order, { items: cart.items, type: cart.type, branch_id: st.tables.find((table) => table.id === cart.table_id)?.branch_id || st.branches[0]?.id || null, table_id: cart.table_id || null, customer_id: cart.customer_id || null, waiter_id: cart.waiter_id || null, notes: cart.notes, tip: Number(payForm.tip || 0), payments, payment_status: 'paid', ...computeTotals(st, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code }) })
      } else {
        order = {
          id: `ord_${Math.random().toString(36).slice(2, 9)}`, number: nextNumber(st, 'order'), branch_id: st.tables.find((table) => table.id === cart.table_id)?.branch_id || st.branches[0]?.id || null,
          table_id: cart.table_id || null, customer_id: cart.customer_id || null, waiter_id: cart.waiter_id || null,
          type: cart.type, status: 'new', payment_status: 'paid', held: false, items: cart.items, notes: cart.notes,
          created_at: new Date().toISOString(), tip: Number(payForm.tip || 0), payments, completed_at: null, completed_by: '', source: 'pos',
          ...computeTotals(st, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code }),
        }
        st.orders.push(order)
      }
      if (cart.type === 'dine_in' && cart.table_id) {
        const tbl = st.tables.find((x) => x.id === cart.table_id)
        if (tbl) { tbl.status = 'occupied'; tbl.current_order_id = order.id }
      }
      completeOrder(st, order, { user: 'POS' })
      return order
    })
    if (result?.error) { toast(result.error, 'error'); return }
    setPayOpen(false)
    if (paymentOrderId) setPaymentOrderId(null)
    else setCart(emptyCart())
    toast(`Payment of ${cur(total)} processed`)
  }

  const printReceipt = () => {
    const t = computeTotals(s, { items: cart.items, discount: cart.discount, discount_code: cart.discount_code })
    const lines = [
      s.settings.restaurant.name, s.settings.restaurant.address, '='.repeat(32),
      ...cart.items.map((i) => `${i.qty}x ${i.name}${i.modifiers.length ? ` (${i.modifiers.map((m) => m.name).join(', ')})` : ''}  ${cur((i.price + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty)}`),
      '='.repeat(32), `Subtotal: ${cur(t.subtotal)}`,
      t.discount ? `Discount: -${cur(t.discount)}` : null, `Tax (${t.tax_rate}%): ${cur(t.tax)}`,
      `TOTAL: ${cur(t.total)}`, '', s.settings.pos.receipt_footer,
    ].filter(Boolean).join('\n')
    const w = window.open('', '_blank', 'width=320,height=480')
    if (w) { w.document.write(`<pre style="font-family:monospace;font-size:12px">${lines}</pre>`); w.print() }
  }

  const editingTableId = cart.editingId ? s.orders.find((order) => order.id === cart.editingId)?.table_id : null
  const tableOptions = s.tables.map((table) => {
    const selectable = table.status === 'available' || table.id === editingTableId
    const branchName = s.branches.find((branch) => branch.id === table.branch_id)?.name
    const sectionName = s.sections.find((section) => section.id === table.section_id)?.name
    const location = [branchName, sectionName].filter(Boolean).join(' / ')
    const status = table.status?.replaceAll('_', ' ') || 'unavailable'
    return {
      value: table.id,
      label: `Table ${table.number} (${table.capacity}p)${location ? ` · ${location}` : ''}${selectable ? '' : ` · ${status}`}`,
      disabled: !selectable,
    }
  })
  const hasSelectableTables = tableOptions.some((option) => !option.disabled)

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)] lg:h-[calc(100vh-6.5rem)]">
      {/* Left: product grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {readyForPayment.length > 0 && (
          <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3" aria-label="Ready orders awaiting payment">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-800">Ready for payment</h2>
              <span className="text-xs text-gray-500">{readyForPayment.length} order{readyForPayment.length === 1 ? '' : 's'}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {readyForPayment.map((order) => {
                const table = s.tables.find((item) => item.id === order.table_id)
                const branch = s.branches.find((item) => item.id === order.branch_id)
                return (
                  <div key={order.id} className="flex min-w-56 items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{order.number}</p>
                      <p className="truncate text-xs capitalize text-gray-500">{order.status}{table ? ` · Table ${table.number}` : ''}{branch ? ` · ${branch.name}` : ''}</p>
                      <p className="text-sm font-medium text-gray-800">{cur(order.total)}</p>
                    </div>
                    <Btn size="sm" onClick={() => openReadyOrderPayment(order)}>Pay</Btn>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search products or SKU…" className="w-56" />
          <div className="flex gap-1.5 flex-wrap">
            <Btn size="sm" variant={catFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setCatFilter('all')}>All</Btn>
            {s.categories.map((c) => (
              <Btn key={c.id} size="sm" variant={catFilter === c.id ? 'primary' : 'secondary'} onClick={() => setCatFilter(c.id)}>{c.name}</Btn>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 overflow-y-auto pr-1 pb-2">
          {products.map((p) => (
            <button key={p.id} onClick={() => addProduct(p)}
              className="bg-white border border-gray-200 rounded-xl p-3 text-left hover:border-emerald-400 hover:shadow-sm transition-all">
              <div className="text-2xl mb-1">{p.emoji}</div>
              <p className="text-sm font-medium text-gray-800 leading-tight">{p.name}</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">{cur(p.price)}</p>
            </button>
          ))}
          {!products.length && <p className="col-span-full text-sm text-gray-400 text-center py-8">No products match</p>}
        </div>
      </div>

      {/* Right: cart */}
      <div className="w-full lg:w-96 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100 space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setCart((c) => ({ ...c, type: t }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${cart.type === t ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {ORDER_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cart.type === 'dine_in' && (
              <Select value={cart.table_id} onChange={(v) => setCart((c) => ({ ...c, table_id: v }))}
                options={[{ value: '', label: !s.tables.length ? 'No tables configured' : hasSelectableTables ? 'Select table…' : 'No available tables' }, ...tableOptions]} />
            )}
            <Select value={cart.customer_id} onChange={(v) => setCart((c) => ({ ...c, customer_id: v }))}
              options={[{ value: '', label: 'Walk-in customer' }, ...s.customers.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select value={cart.waiter_id} onChange={(v) => setCart((c) => ({ ...c, waiter_id: v }))}
              options={[{ value: '', label: 'No waiter' }, ...s.employees.filter((e) => e.department === 'Front of House').map((e) => ({ value: e.id, label: e.name }))]} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.items.map((i) => (
            <div key={i.key} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800">{i.name}</p>
                <button onClick={() => voidItem(i.key)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
              {i.modifiers.length > 0 && <p className="text-xs text-gray-500">+ {i.modifiers.map((m) => m.name).join(', ')}</p>}
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => changeQty(i.key, -1)} className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-100"><Minus size={12} /></button>
                  <span className="text-sm font-semibold w-6 text-center">{i.qty}</span>
                  <button onClick={() => changeQty(i.key, 1)} className="p-1 bg-white border border-gray-200 rounded hover:bg-gray-100"><Plus size={12} /></button>
                </div>
                <span className="text-sm font-semibold text-gray-900">{cur((i.price + i.modifiers.reduce((a, m) => a + m.price, 0)) * i.qty)}</span>
              </div>
              <input value={i.notes} onChange={(e) => setItemNote(i.key, e.target.value)} placeholder="Item note (e.g. no onions)"
                className="mt-1.5 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          ))}
          {!cart.items.length && <p className="text-sm text-gray-400 text-center py-8">Cart is empty — tap products to add</p>}
        </div>

        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="flex gap-1.5">
            <input value={cart.discount_code} onChange={(e) => setCart((c) => ({ ...c, discount_code: e.target.value }))}
              placeholder="Coupon code" className={`${inputCls} flex-1`} />
            <Btn variant="secondary" size="sm" onClick={() => applyCoupon(cart.discount_code)}><Tag size={13} /> Apply</Btn>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{cur(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount {cart.discount_code && `(${cart.discount_code})`}</span><span>−{cur(totals.discount)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>Tax ({totals.tax_rate}%)</span><span>{cur(totals.tax)}</span></div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{cur(totals.total)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Btn size="sm" variant="secondary" onClick={holdOrder} disabled={!cart.items.length}><Pause size={13} /> Hold</Btn>
            <Btn size="sm" variant="secondary" onClick={() => sendToKitchen(false)} disabled={!cart.items.length}><ChefHat size={13} /> Kitchen</Btn>
            <Btn size="sm" variant="secondary" onClick={printReceipt} disabled={!cart.items.length}><Printer size={13} /> Receipt</Btn>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Btn size="sm" variant="secondary" onClick={() => setHeldOpen(true)}>
              <RotateCcw size={13} /> Resume ({heldOrders.length})
            </Btn>
            <Btn size="sm" onClick={openPayment} disabled={!cart.items.length}>Charge {cur(totals.total)}</Btn>
          </div>
        </div>
      </div>

      {/* Modifier picker */}
      <Modal open={!!modifierTarget} onClose={() => setModifierTarget(null)} title={modifierTarget ? `Customize ${modifierTarget.product.name}` : ''}>
        {modifierTarget && (
          <div className="space-y-4">
            {modifierTarget.groups.map((g) => (
              <div key={g.id}>
                <p className="text-sm font-medium text-gray-700 mb-2">{g.name} <span className="text-xs text-gray-400">(choose up to {g.max})</span></p>
                <div className="space-y-1.5">
                  {g.modifiers.map((m) => {
                    const sel = modifierTarget.selected[g.id]
                    const isSel = sel?.id === m.id
                    return (
                      <button key={m.id}
                        onClick={() => setModifierTarget((t) => ({ ...t, selected: { ...t.selected, [g.id]: isSel ? undefined : m } }))}
                        className={`w-full flex justify-between items-center px-3 py-2 rounded-lg border text-sm ${isSel ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                        <span>{m.name}</span>
                        <span className="text-xs text-gray-500">{m.price ? `+${cur(m.price)}` : 'Free'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <Btn className="w-full" onClick={() => {
              const mods = Object.values(modifierTarget.selected).filter(Boolean)
              pushItem(modifierTarget.product, mods)
              setModifierTarget(null)
            }}>Add to order</Btn>
          </div>
        )}
      </Modal>

      {/* Held orders */}
      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title={`Held orders (${heldOrders.length})`}>
        <div className="space-y-2">
          {heldOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{o.number} · {ORDER_TYPE_LABELS[o.type]}</p>
                <p className="text-xs text-gray-500">{o.items.length} items · {cur(o.total)} · {new Date(o.created_at).toLocaleTimeString()}</p>
              </div>
              <div className="flex gap-1.5">
                <Btn size="sm" onClick={() => resumeOrder(o)}>Resume</Btn>
                <Btn size="sm" variant="danger" onClick={() => cancelHeld(o)}><X size={13} /></Btn>
              </div>
            </div>
          ))}
          {!heldOrders.length && <p className="text-sm text-gray-400 text-center py-6">No held orders</p>}
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal open={payOpen} onClose={() => { setPayOpen(false); setPaymentOrderId(null) }} title={paymentOrder ? `Process payment · ${paymentOrder.number}` : 'Process payment'}
        footer={<>
          <Btn variant="secondary" onClick={() => { setPayOpen(false); setPaymentOrderId(null) }}>Cancel</Btn>
          <Btn onClick={processPayment}>Complete payment</Btn>
        </>}>
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-xs text-emerald-700">Amount due</p>
            <p className="text-2xl font-bold text-emerald-800">{cur(paymentOrderDue + Number(payForm.tip || 0))}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment method">
              <Select value={payForm.method} onChange={(v) => setPayForm((f) => ({ ...f, method: v }))} options={METHODS.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field label={`Amount (${payForm.method})`} hint="Leave empty to pay full amount">
              <input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Second method (split payment)">
              <Select value={payForm.method2} onChange={(v) => setPayForm((f) => ({ ...f, method2: v }))}
                options={[{ value: '', label: 'None' }, ...METHODS.filter((m) => m !== payForm.method).map((m) => ({ value: m, label: m }))]} />
            </Field>
            <Field label="Amount (second)">
              <input type="number" min="0" step="0.01" value={payForm.amount2} onChange={(e) => setPayForm((f) => ({ ...f, amount2: e.target.value }))} className={inputCls} disabled={!payForm.method2} />
            </Field>
            <Field label="Tip">
              <input type="number" min="0" step="0.01" value={payForm.tip} onChange={(e) => setPayForm((f) => ({ ...f, tip: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          {payForm.method === 'Cash' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2">
              <User size={14} />
              {openSession ? `Register session open — ${openSession.cashier} (${cur(openSession.opening_cash)} opening)` : 'No cash register session is open. Open one in Cash Management to accept cash.'}
            </div>
          )}
          {(() => {
            const total = totals.total + Number(payForm.tip || 0)
            const paid1 = payForm.amount ? Number(payForm.amount) : total
            const remaining = Math.round((total - Math.min(paid1, total)) * 100) / 100
            const change = payForm.method === 'Cash' && payForm.amount && Number(payForm.amount) > total ? Number(payForm.amount) - total : 0
            return (
              <div className="text-sm space-y-1 text-gray-600">
                {remaining > 0.009 && <p>Remaining: <span className="font-semibold text-amber-600">{cur(remaining)}</span></p>}
                {change > 0 && <p>Change due: <span className="font-semibold text-emerald-600">{cur(change)}</span></p>}
              </div>
            )
          })()}
        </div>
      </Modal>
    </div>
  )
}
