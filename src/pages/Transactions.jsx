import { useEffect, useState, useMemo } from 'react'
import { db } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../components/ui'
import TransactionModal from '../components/TransactionModal'
import {
  Plus, Search, Filter, Pencil, Trash2, ArrowUpDown,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

const CATEGORY_LABELS = {
  sales: 'Sales',
  other_income: 'Other Income',
  food_cost: 'Food Cost',
  fuel: 'Fuel',
  rent: 'Rent',
  salaries: 'Salaries',
  utilities: 'Utilities',
  marketing: 'Marketing',
  loan_principal: 'Loan Principal',
  loan_interest: 'Loan Interest',
  vat_paid: 'VAT Paid',
  corporate_tax: 'Corporate Tax',
  maintenance: 'Maintenance',
  miscellaneous: 'Miscellaneous',
  contingency: 'Contingency',
}

export default function Transactions() {
  const { user } = useAuth()
  const cur = useCurrency()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)

  // Filters
  const [filterType, setFilterType] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Sorting
  const [sortField, setSortField] = useState('transaction_date')
  const [sortDir, setSortDir] = useState('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  useEffect(() => {
    if (!user) return
    fetchTransactions()
  }, [user])

  const fetchTransactions = async () => {
    setLoading(true)
    const { data, error } = await db('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })

    if (!error) setTransactions(data || [])
    setLoading(false)
  }

  const handleSave = async (txData) => {
    if (editingTx) {
      const { error } = await db('transactions')
        .update(txData)
        .eq('id', editingTx.id)
      if (!error) fetchTransactions()
    } else {
      const { error } = await db('transactions')
        .insert({ ...txData, user_id: user.id })
      if (!error) fetchTransactions()
    }
    setEditingTx(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return
    const { error } = await db('transactions')
      .delete()
      .eq('id', id)
    if (!error) fetchTransactions()
  }

  const openEdit = (tx) => {
    setEditingTx(tx)
    setModalOpen(true)
  }

  const openAdd = () => {
    setEditingTx(null)
    setModalOpen(true)
  }

  // Filtered & sorted data
  const filtered = useMemo(() => {
    let data = [...transactions]

    if (filterType !== 'all') {
      data = data.filter((t) => t.type === filterType)
    }
    if (dateFrom) {
      data = data.filter((t) => t.transaction_date >= dateFrom)
    }
    if (dateTo) {
      data = data.filter((t) => t.transaction_date <= dateTo)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      data = data.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(q)) ||
          CATEGORY_LABELS[t.category]?.toLowerCase().includes(q)
      )
    }

    data.sort((a, b) => {
      let av = a[sortField]
      let bv = b[sortField]
      if (sortField === 'amount') {
        av = Number(av)
        bv = Number(bv)
      }
      if (sortField === 'transaction_date') {
        av = new Date(av)
        bv = new Date(bv)
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return data
  }, [transactions, filterType, dateFrom, dateTo, searchQuery, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your income and expense records</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-end sm:gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              placeholder="Search description or category..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('transaction_date')} className="flex items-center gap-1 hover:text-gray-900">
                        Date <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      <button onClick={() => toggleSort('amount')} className="flex items-center gap-1 hover:text-gray-900">
                        Amount <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {format(parseISO(tx.transaction_date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.type === 'income'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                            }`}>
                            {CATEGORY_LABELS[tx.category] || tx.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                          {tx.description || '-'}
                        </td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                          {tx.type === 'income' ? '+' : '-'}{cur(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 capitalize">
                          {tx.payment_method.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openEdit(tx)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-700 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTx(null) }}
        onSubmit={handleSave}
        initialData={editingTx}
      />
    </div>
  )
}
