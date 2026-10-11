import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useCurrency } from './ui'

export default function KPICard({ title, amount, type, icon: Icon, isPercentage = false }) {
  const cur = useCurrency()
  const isPositive = type === 'positive'
  const isNeutral = type === 'neutral'

  const formattedValue = isPercentage
    ? `${Number(amount).toFixed(1)}%`
    : cur(amount)

  const subtext = isPercentage
    ? 'of revenue'
    : isPositive
      ? 'Cash Inflow'
      : isNeutral
        ? 'Net Position'
        : 'Cash Outflow'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`mt-2 text-2xl font-bold ${isPositive ? 'text-emerald-600' : isNeutral ? 'text-gray-900' : 'text-red-600'
            }`}>
            {formattedValue}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-600' :
            isNeutral ? 'bg-gray-100 text-gray-600' :
              'bg-red-50 text-red-600'
          }`}>
          {Icon && <Icon size={20} />}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-xs">
        {isPositive ? (
          <ArrowUpRight size={14} className="text-emerald-600" />
        ) : isNeutral ? null : (
          <ArrowDownRight size={14} className="text-red-600" />
        )}
        <span className={isPositive ? 'text-emerald-600' : isNeutral ? 'text-gray-400' : 'text-red-600'}>
          {subtext}
        </span>
      </div>
    </div>
  )
}
