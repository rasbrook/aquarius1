import { useEffect, useState } from 'react'
import { db } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../components/ui'
import { useRMS } from '../lib/rmsData'
import { Plus, Trash2, ShoppingCart, Calendar, CreditCard } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer']

export default function SalesEntry() {
  const { user } = useAuth()
  const cur = useCurrency()
  const currency = useRMS().settings.restaurant.currency
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [items, setItems] = useState([{ name: '', qty: 1, price: '' }])

  useEffect(() => {
    if (!user) return
    fetchSales()
  }, [user])

  const fetchSales = async () => {
    setLoading(true)
    const { data } = await db('sales')
      .select('*')
      .order('date', { ascending: false })
    setSales(data || [])
    setLoading(false)
  }

  const addItemRow = () => setItems([...items, { name: '', qty: 1, price: '' }])
  const removeItemRow = (idx) => setItems(items.filter((_, i) => i !== idx))
  const updateItem = (idx, field, value) => {
    const next = [...items]
    next[idx][field] = field === 'qty' ? parseInt(value) || 0 : value
    setItems(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validItems = items.filter((it) => it.name.trim() && parseFloat(it.price) > 0 && parseInt(it.qty) > 0)
    if (validItems.length === 0) {
      console.error('No valid items to save')
      return
    }

    const total = validItems.reduce((sum, it) => sum + parseFloat(it.price) * parseInt(it.qty), 0)

    try {
      // Insert sale first (simpler - no transaction linking needed for basic functionality)
      const sale = {
        user_id: user.id,
        date,
        items: validItems.map((it) => ({ name: it.name.trim(), qty: parseInt(it.qty), price: parseFloat(it.price) })),
        total,
        payment_method: paymentMethod,
        recorded_by: user?.email?.split('@')[0] || 'Owner',
      }

      const { data: saleResult, error: saleError } = await db('sales').insert(sale)
      if (saleError) {
        console.error('Sale insert error:', saleError)
        return
      }
      console.log('Sale inserted:', saleResult)

      // Also record as income transaction
      const { error: txError } = await db('transactions').insert({
        user_id: user.id,
        type: 'income',
        category: 'sales',
        amount: total,
        description: `Sale recorded (${validItems.length} items)`,
        transaction_date: date,
        payment_method: paymentMethod,
      })
      if (txError) {
        console.error('Transaction insert error:', txError)
      }

      setItems([{ name: '', qty: 1, price: '' }])
      setShowForm(false)
      await fetchSales()
    } catch (err) {
      console.error('Submit error:', err)
    }
  }

  const handleDeleteSale = async (id) => {
    if (!confirm('Delete this sale record?')) return
    try {
      await db('sales').delete().eq('id', id)
      await fetchSales()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  // Live total from all rows (display only — saved total uses validated items)
  const displayTotal = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Entry</h1>
          <p className="text-sm text-gray-500 mt-1">Record every sale with item-level detail</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Record New Sale'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">New Sale</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 w-full">
                  <p className="text-xs text-emerald-600">Total</p>
                  <p className="text-lg font-bold text-emerald-700">{cur(displayTotal)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <div className="col-span-5">Item Name</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-3">Unit Price ({currency})</div>
                <div className="col-span-2">Subtotal</div>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input type="text" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      placeholder="e.g. Grilled Chicken" required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="1" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                      required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" step="0.01" min="0" value={item.price} onChange={(e) => updateItem(idx, 'price', e.target.value)}
                      placeholder="0.00" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {cur((parseFloat(item.price) || 0) * (parseInt(item.qty) || 0))}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(idx)} className="text-gray-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" onClick={addItemRow} className="text-sm text-emerald-600 font-medium hover:underline">
                + Add another item
              </button>
            </div>

            <div className="pt-2">
              <button type="submit" className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                Save Sale & Record Income
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Sales History</h2>
          <p className="text-sm text-gray-500">Every recorded sale with item breakdown</p>
        </div>
        {sales.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <ShoppingCart size={32} className="mx-auto mb-3 text-gray-300" />
            <p>No sales recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sales.map((sale) => (
              <div key={sale.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {format(parseISO(sale.date), 'MMM d, yyyy')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 capitalize">
                        {sale.payment_method?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400">by {sale.recorded_by}</span>
                    </div>
                    <div className="space-y-1">
                      {sale.items?.map((it, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="w-6 text-right text-gray-400">{it.qty}x</span>
                          <span>{it.name}</span>
                          <span className="text-gray-400">@</span>
                          <span>{cur(it.price)}</span>
                          <span className="text-gray-400">=</span>
                          <span className="font-medium text-gray-700">{cur(it.qty * it.price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-emerald-600">{cur(sale.total)}</p>
                    <button onClick={() => handleDeleteSale(sale.id)} className="text-xs text-red-500 hover:underline mt-1">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
