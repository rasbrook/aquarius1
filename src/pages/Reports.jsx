import { useEffect, useState, useMemo } from 'react'
import { db } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useCurrency } from '../components/ui'
import { format, startOfYear, endOfYear, parseISO } from 'date-fns'
import {
  UtensilsCrossed, Percent, Briefcase, Home
} from 'lucide-react'

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

const OPERATING_CATEGORIES = [
  'fuel', 'rent', 'salaries', 'utilities', 'marketing',
  'maintenance', 'miscellaneous', 'contingency',
]

const NON_OPERATING_CATEGORIES = [
  'loan_principal', 'loan_interest', 'vat_paid', 'corporate_tax',
]

export default function Reports() {
  const { user } = useAuth()
  const cur = useCurrency()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

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

  const report = useMemo(() => {
    const now = new Date()
    const ytdStart = startOfYear(now)
    const ytdEnd = endOfYear(now)

    const ytdTransactions = transactions.filter((t) => {
      const d = parseISO(t.transaction_date)
      return d >= ytdStart && d <= ytdEnd
    })

    const totalSales = ytdTransactions
      .filter((t) => t.type === 'income' && t.category === 'sales')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalOtherIncome = ytdTransactions
      .filter((t) => t.type === 'income' && t.category === 'other_income')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalRevenue = totalSales + totalOtherIncome

    const totalFoodCost = ytdTransactions
      .filter((t) => t.type === 'expense' && t.category === 'food_cost')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const grossProfit = totalRevenue - totalFoodCost
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const foodCostPct = totalSales > 0 ? (totalFoodCost / totalSales) * 100 : 0

    const totalExpenses = ytdTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const operatingExpenses = ytdTransactions
      .filter((t) => t.type === 'expense' && OPERATING_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const nonOperatingExpenses = ytdTransactions
      .filter((t) => t.type === 'expense' && NON_OPERATING_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const operatingProfit = grossProfit - operatingExpenses
    const netProfit = totalRevenue - totalExpenses
    const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    const totalVat = ytdTransactions
      .filter((t) => t.type === 'expense' && t.category === 'vat_paid')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const totalCorpTax = ytdTransactions
      .filter((t) => t.type === 'expense' && t.category === 'corporate_tax')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    // Key ratios
    const totalSalaries = ytdTransactions
      .filter((t) => t.type === 'expense' && t.category === 'salaries')
      .reduce((sum, t) => sum + Number(t.amount), 0)
    const totalRent = ytdTransactions
      .filter((t) => t.type === 'expense' && t.category === 'rent')
      .reduce((sum, t) => sum + Number(t.amount), 0)

    const laborCostPct = totalSales > 0 ? (totalSalaries / totalSales) * 100 : 0
    const rentPct = totalSales > 0 ? (totalRent / totalSales) * 100 : 0

    // Expense breakdown by category (YTD)
    const expenseBreakdown = {}
    ytdTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const label = CATEGORY_LABELS[t.category] || t.category
        expenseBreakdown[label] = (expenseBreakdown[label] || 0) + Number(t.amount)
      })

    const sortedBreakdown = Object.entries(expenseBreakdown)
      .sort((a, b) => b[1] - a[1])

    return {
      year: now.getFullYear(),
      totalSales,
      totalOtherIncome,
      totalRevenue,
      totalFoodCost,
      grossProfit,
      grossMarginPct,
      foodCostPct,
      totalExpenses,
      operatingExpenses,
      nonOperatingExpenses,
      operatingProfit,
      netProfit,
      profitMarginPct,
      totalVat,
      totalCorpTax,
      laborCostPct,
      rentPct,
      sortedBreakdown,
    }
  }, [transactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  const formatPct = (v) => `${v.toFixed(1)}%`

  const PLRow = ({ label, amount, indent = false, bold = false, border = false, pct = null, color = 'text-gray-900' }) => (
    <div className={`flex items-center justify-between py-2 ${border ? 'border-t border-gray-200' : ''} ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} text-gray-700`}>{label}</span>
      <div className="flex items-center gap-3">
        {pct !== null && (
          <span className="text-xs text-gray-400">{formatPct(pct)}</span>
        )}
        <span className={`text-sm ${bold ? 'font-bold' : 'font-semibold'} ${color}`}>
          {cur(amount)}
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Snapshot</h1>
        <p className="text-sm text-gray-500 mt-1">Year-to-date financial summary for {report.year}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{cur(report.totalRevenue)}</p>
          <p className="mt-1 text-xs text-gray-400">Sales + Other Income</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Gross Profit</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{cur(report.grossProfit)}</p>
          <p className="mt-1 text-xs text-gray-400">Revenue minus Food Cost</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Net Profit</p>
          <p className={`mt-2 text-2xl font-bold ${report.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {cur(report.netProfit)}
          </p>
          <p className="mt-1 text-xs text-gray-400">After all expenses</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Profit Margin</p>
          <p className={`mt-2 text-2xl font-bold ${report.profitMarginPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPct(report.profitMarginPct)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Net Profit / Revenue</p>
        </div>
      </div>

      {/* P&L Statement */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit & Loss Statement</h2>
        <div className="space-y-1">
          <PLRow label="Sales Revenue" amount={report.totalSales} />
          <PLRow label="Other Income" amount={report.totalOtherIncome} indent />
          <PLRow label="Total Revenue" amount={report.totalRevenue} bold border />

          <PLRow label="Cost of Goods Sold (Food Cost)" amount={report.totalFoodCost} indent color="text-red-600" />
          <PLRow label="Gross Profit" amount={report.grossProfit} bold border pct={report.grossMarginPct} color="text-blue-600" />

          <div className="pt-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Operating Expenses</span>
          </div>
          {report.sortedBreakdown
            .filter(([label]) => {
              const cat = Object.entries(CATEGORY_LABELS).find(([, v]) => v === label)?.[0]
              return cat && OPERATING_CATEGORIES.includes(cat)
            })
            .map(([label, amount]) => (
              <PLRow key={label} label={label} amount={amount} indent color="text-red-600" />
            ))}
          <PLRow label="Total Operating Expenses" amount={report.operatingExpenses} bold border />

          <PLRow label="Operating Profit" amount={report.operatingProfit} bold border pct={report.totalRevenue > 0 ? (report.operatingProfit / report.totalRevenue) * 100 : 0} color="text-blue-600" />

          <div className="pt-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Non-Operating</span>
          </div>
          {report.sortedBreakdown
            .filter(([label]) => {
              const cat = Object.entries(CATEGORY_LABELS).find(([, v]) => v === label)?.[0]
              return cat && NON_OPERATING_CATEGORIES.includes(cat)
            })
            .map(([label, amount]) => (
              <PLRow key={label} label={label} amount={amount} indent color="text-red-600" />
            ))}

          <PLRow label="NET PROFIT" amount={report.netProfit} bold border pct={report.profitMarginPct} color={report.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        </div>
      </div>

      {/* Key Ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Food Cost %</p>
            <p className="text-xl font-bold text-gray-900">{formatPct(report.foodCostPct)}</p>
            <p className="text-xs text-gray-400">of sales</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Labor Cost %</p>
            <p className="text-xl font-bold text-gray-900">{formatPct(report.laborCostPct)}</p>
            <p className="text-xs text-gray-400">of sales</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Home size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Rent %</p>
            <p className="text-xl font-bold text-gray-900">{formatPct(report.rentPct)}</p>
            <p className="text-xs text-gray-400">of sales</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Percent size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Gross Margin</p>
            <p className="text-xl font-bold text-gray-900">{formatPct(report.grossMarginPct)}</p>
            <p className="text-xs text-gray-400">of revenue</p>
          </div>
        </div>
      </div>

      {/* Tax Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Summary (Year-to-Date)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-100">
            <div>
              <p className="text-sm font-medium text-amber-800">VAT Remitted</p>
              <p className="text-xs text-amber-600 mt-0.5">Value Added Tax paid</p>
            </div>
            <p className="text-xl font-bold text-amber-700">{cur(report.totalVat)}</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div>
              <p className="text-sm font-medium text-blue-800">Corporate Tax Accrued</p>
              <p className="text-xs text-blue-600 mt-0.5">Corporate income tax</p>
            </div>
            <p className="text-xl font-bold text-blue-700">{cur(report.totalCorpTax)}</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Total Tax Burden</p>
            <p className="text-lg font-bold text-gray-900">{cur(report.totalVat + report.totalCorpTax)}</p>
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown (Year-to-Date)</h2>
        {report.sortedBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400">No expenses recorded yet this year.</p>
        ) : (
          <div className="space-y-3">
            {report.sortedBreakdown.map(([label, amount]) => {
              const pct = report.totalExpenses > 0 ? (amount / report.totalExpenses) * 100 : 0
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-900 font-semibold">{cur(amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% of total expenses</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
