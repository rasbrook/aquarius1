import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRMS, update, nextNumber, computeTotals, notify, logAudit } from '../lib/rmsData'
import { Badge, Btn, Field, inputCls, Select, useCurrency, toast } from '../components/ui'
import { CheckCircle2, Minus, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react'

const emptyGuest = { name: '', phone: '', email: '', notes: '', sms_marketing_consent: false, email_marketing_consent: false }

export default function DirectOrderPage() {
    const { user } = useAuth()
    const s = useRMS()
    const cur = useCurrency()
    const [searchParams] = useSearchParams()
    const tableId = searchParams.get('table') || ''
    const table = s.tables.find((item) => item.id === tableId)
    const [cart, setCart] = useState([])
    const [guest, setGuest] = useState(emptyGuest)
    const [orderType, setOrderType] = useState(table ? 'dine_in' : 'pickup')
    const [submitted, setSubmitted] = useState(null)
    const enabled = Boolean(s.settings.marketing?.direct_ordering?.enabled)
    const products = s.products.filter((product) => product.available)
    const categories = [...new Set(products.map((product) => product.category_id))]
    const [category, setCategory] = useState('all')
    const visibleProducts = category === 'all' ? products : products.filter((product) => product.category_id === category)
    const totals = computeTotals(s, { items: cart.map((line) => ({ ...line, modifiers: [] })) })
    const upsellProducts = [...new Set((s.upsell_rules || [])
        .filter((rule) => rule.active && cart.some((item) => item.product_id === rule.trigger_product_id) && !cart.some((item) => item.product_id === rule.suggested_product_id))
        .map((rule) => rule.suggested_product_id))]
        .map((productId) => products.find((product) => product.id === productId))
        .filter(Boolean)
    const matchedCustomer = useMemo(() => {
        const digits = guest.phone.replace(/\D/g, '')
        return digits.length >= 7 ? s.customers.find((customer) => customer.phone.replace(/\D/g, '') === digits) : null
    }, [guest.phone, s.customers])

    useEffect(() => {
        setGuest((current) => ({
            ...current,
            sms_marketing_consent: Boolean(matchedCustomer?.sms_marketing_consent),
            email_marketing_consent: Boolean(matchedCustomer?.email_marketing_consent),
        }))
    }, [matchedCustomer?.id])

    const add = (product) => setCart((items) => {
        const existing = items.find((item) => item.product_id === product.id)
        return existing
            ? items.map((item) => item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item)
            : [...items, { product_id: product.id, name: product.name, price: product.price, qty: 1 }]
    })

    const changeQuantity = (productId, delta) => setCart((items) => items
        .map((item) => item.product_id === productId ? { ...item, qty: item.qty + delta } : item)
        .filter((item) => item.qty > 0))

    const submitOrder = () => {
        if (!cart.length || !guest.name.trim() || guest.phone.replace(/\D/g, '').length < 7) {
            toast('Add items and enter your name and valid phone number', 'error')
            return
        }
        const orderId = `ord_${Math.random().toString(36).slice(2, 9)}`
        const result = update((state) => {
            state.customers = state.customers || []
            let customer = state.customers.find((item) => item.phone.replace(/\D/g, '') === guest.phone.replace(/\D/g, ''))
            if (!customer) {
                customer = { id: `cus_${Math.random().toString(36).slice(2, 9)}`, name: guest.name.trim(), phone: guest.phone.trim(), email: guest.email.trim(), birthday: '', anniversary: '', dietary_preferences: '', sms_marketing_consent: guest.sms_marketing_consent, email_marketing_consent: guest.email_marketing_consent, address: '', points: 0, visits: 0, total_spent: 0, last_visit: null, segment: 'New' }
                state.customers.push(customer)
            } else {
                customer.name = guest.name.trim()
                if (guest.email.trim()) customer.email = guest.email.trim()
                customer.sms_marketing_consent = Boolean(guest.sms_marketing_consent)
                customer.email_marketing_consent = Boolean(guest.email_marketing_consent)
            }
            const order = {
                id: orderId,
                number: nextNumber(state, 'order'),
                branch_id: table?.branch_id || state.branches[0]?.id || null,
                table_id: table?.id || null,
                customer_id: customer.id,
                waiter_id: null,
                type: table ? 'dine_in' : orderType,
                status: 'new',
                payment_status: 'unpaid',
                held: false,
                items: cart,
                notes: guest.notes.trim(),
                created_at: new Date().toISOString(),
                tip: 0,
                payments: [],
                completed_at: null,
                completed_by: '',
                source: 'direct',
                ...computeTotals(state, { items: cart.map((item) => ({ ...item, modifiers: [] })) }),
            }
            state.orders.push(order)
            if (table) {
                const matchedTable = state.tables.find((item) => item.id === table.id)
                if (matchedTable) { matchedTable.status = 'occupied'; matchedTable.current_order_id = order.id }
            }
            notify(state, 'order', `Direct order ${order.number} received`)
            logAudit(state, { user: 'Online guest', action: 'create', entity: 'direct_order', entity_id: order.number })
            return order.number
        })
        setSubmitted(result)
        setCart([])
    }

    if (!user || !enabled) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-12">
                <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <UtensilsCrossed size={30} className="mx-auto mb-4 text-emerald-700" />
                    <h1 className="text-xl font-semibold text-gray-900">Direct guest ordering is not connected</h1>
                    <p className="mt-2 text-sm text-gray-600">{!user
                        ? 'A secure public ordering service is required before guests can place orders from this link.'
                        : 'Enable direct ordering in Marketing after a public ordering service is connected.'}</p>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 py-12">
                <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <CheckCircle2 size={32} className="mx-auto mb-4 text-emerald-600" />
                    <h1 className="text-xl font-semibold text-gray-900">Order request received</h1>
                    <p className="mt-2 text-sm text-gray-600">Reference <strong>{submitted}</strong></p>
                    <p className="mt-2 text-sm text-gray-500">The restaurant will confirm availability and arrange payment. No payment has been taken.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="border-b border-gray-200 bg-white px-4 py-4">
                <div className="mx-auto flex max-w-6xl items-center gap-3">
                    <UtensilsCrossed size={22} className="text-emerald-700" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{s.settings.restaurant.name}</p>
                        <p className="text-xs text-gray-500">Order direct</p>
                    </div>
                    {table && <Badge color="bg-emerald-100 text-emerald-700">Table {table.number}</Badge>}
                </div>
            </header>
            <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section>
                    <div className="mb-4 flex flex-wrap gap-2">
                        <button onClick={() => setCategory('all')} className={`rounded-lg px-3 py-1.5 text-sm ${category === 'all' ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>All items</button>
                        {categories.map((id) => (
                            <button key={id} onClick={() => setCategory(id)} className={`rounded-lg px-3 py-1.5 text-sm ${category === id ? 'bg-emerald-700 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                {s.categories.find((item) => item.id === id)?.name || 'Menu'}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                        {visibleProducts.map((product) => (
                            <button key={product.id} onClick={() => add(product)} className="rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-emerald-400">
                                {product.emoji && <span className="mb-2 block text-2xl">{product.emoji}</span>}
                                <span className="block text-sm font-medium text-gray-900">{product.name}</span>
                                <span className="mt-1 block text-sm font-semibold text-emerald-700">{cur(product.price)}</span>
                            </button>
                        ))}
                        {!visibleProducts.length && <p className="col-span-full py-10 text-center text-sm text-gray-500">No menu items available.</p>}
                    </div>
                </section>
                <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><ShoppingBag size={17} /> Your order</h2>
                    <div className="space-y-2">
                        {cart.map((item) => (
                            <div key={item.product_id} className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{item.name}</p><p className="text-xs text-gray-500">{cur(item.price * item.qty)}</p></div>
                                <div className="flex shrink-0 items-center gap-2"><button aria-label={`Remove one ${item.name}`} onClick={() => changeQuantity(item.product_id, -1)} className="rounded border p-1"><Minus size={12} /></button><span className="w-4 text-center text-sm">{item.qty}</span><button aria-label={`Add one ${item.name}`} onClick={() => changeQuantity(item.product_id, 1)} className="rounded border p-1"><Plus size={12} /></button></div>
                            </div>
                        ))}
                        {!cart.length && <p className="py-4 text-center text-sm text-gray-400">Your order is empty.</p>}
                    </div>
                    {upsellProducts.length > 0 && (
                        <div className="my-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                            <p className="mb-2 text-xs font-semibold text-emerald-800">Frequently added</p>
                            <div className="space-y-1.5">
                                {upsellProducts.map((product) => (
                                    <button key={product.id} onClick={() => add(product)} className="flex w-full items-center justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-left text-xs hover:bg-emerald-50">
                                        <span className="truncate font-medium text-gray-800">{product.name}</span>
                                        <span className="shrink-0 text-emerald-700">{cur(product.price)} <Plus size={12} className="inline" /></span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {!table && <Field label="Order type"><Select value={orderType} onChange={setOrderType} options={[{ value: 'pickup', label: 'Pickup' }, { value: 'delivery', label: 'Delivery' }, { value: 'takeaway', label: 'Takeaway' }]} /></Field>}
                    <div className="my-3 border-t border-gray-200 pt-3 text-sm">
                        <div className="flex justify-between font-semibold"><span>Total</span><span>{cur(totals.total)}</span></div>
                        <p className="mt-1 text-xs text-gray-500">Payment is arranged with the restaurant after confirmation.</p>
                    </div>
                    <div className="space-y-3">
                        <Field label="Name"><input className={inputCls} value={guest.name} onChange={(event) => setGuest((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></Field>
                        <Field label="Phone"><input className={inputCls} type="tel" value={guest.phone} onChange={(event) => setGuest((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" /></Field>
                        <Field label="Email (optional)"><input className={inputCls} type="email" value={guest.email} onChange={(event) => setGuest((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></Field>
                        <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                            <p>Optional: receive offers and restaurant updates.</p>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={guest.sms_marketing_consent} onChange={(event) => setGuest((current) => ({ ...current, sms_marketing_consent: event.target.checked }))} /> I agree to receive marketing texts.</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={guest.email_marketing_consent} onChange={(event) => setGuest((current) => ({ ...current, email_marketing_consent: event.target.checked }))} /> I agree to receive marketing emails.</label>
                        </div>
                        <Field label="Order notes"><textarea className={`${inputCls} min-h-16`} value={guest.notes} onChange={(event) => setGuest((current) => ({ ...current, notes: event.target.value }))} placeholder="Dietary needs or delivery notes" /></Field>
                        {matchedCustomer && <p className="text-xs text-emerald-700">Loyalty profile found · {matchedCustomer.points || 0} points. Points are added after the order is completed.</p>}
                        <Btn className="w-full" onClick={submitOrder} disabled={!cart.length}>Send order request</Btn>
                    </div>
                </aside>
            </main>
        </div>
    )
}