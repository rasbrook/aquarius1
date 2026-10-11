import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useRMS } from '../lib/rmsData'

const INCOME_CATEGORIES = ['sales', 'other_income']
const EXPENSE_CATEGORIES = [
  'food_cost', 'fuel', 'rent', 'salaries', 'utilities',
  'marketing', 'loan_principal', 'loan_interest', 'vat_paid',
  'corporate_tax', 'maintenance', 'miscellaneous', 'contingency'
]
const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer']

export default function TransactionModal({ isOpen, onClose, onSubmit, initialData = null }) {
  const currency = useRMS().settings.restaurant.currency
  const [type, setType] = useState('income')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  useEffect(() => {
    if (initialData) {
      setType(initialData.type)
      setCategory(initialData.category)
      setAmount(initialData.amount.toString())
      setDescription(initialData.description || '')
      setTransactionDate(initialData.transaction_date)
      setPaymentMethod(initialData.payment_method)
    } else {
      setType('income')
      setCategory('')
      setAmount('')
      setDescription('')
      setTransactionDate(new Date().toISOString().split('T')[0])
      setPaymentMethod('cash')
    }
  }, [initialData, isOpen])

  // Reset category when type changes (only if not editing)
  useEffect(() => {
    if (!initialData) {
      setCategory('')
    }
  }, [type, initialData])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!category || !amount || parseFloat(amount) <= 0) return

    setSaving(true)
    await onSubmit({
      type,
      category,
      amount: parseFloat(amount),
      description: description.trim() || null,
      transaction_date: transactionDate,
      payment_method: paymentMethod,
    })
    setSaving(false)
    onClose()
  }

  const formatLabel = (str) =>
    str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {initialData ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="flex gap-2">
              {['income', 'expense'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${type === t
                      ? t === 'income'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  {t === 'income' ? 'Income' : 'Expense'}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c} value={c}>{formatLabel(c)}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currency})</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{formatLabel(m)}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="e.g. Weekly supply order"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !category}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : initialData ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
