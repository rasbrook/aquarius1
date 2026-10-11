import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { Card, Field, PageHeader, inputCls, useCurrency } from '../components/ui'

export default function TaxCalculatorPage() {
    const cur = useCurrency()
    const [taxRate, setTaxRate] = useState('')
    const [totalPrice, setTotalPrice] = useState('')
    const rate = Number(taxRate)
    const total = Number(totalPrice)
    const hasResult = taxRate !== '' && totalPrice !== '' && Number.isFinite(rate) && rate >= 0 && Number.isFinite(total) && total >= 0
    const beforeTax = hasResult ? total / (1 + rate / 100) : 0
    const taxAmount = hasResult ? total - beforeTax : 0

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader title="Tax Calculator" subtitle="Find the pre-tax price from a tax-inclusive total" />

            <Card>
                <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Tax percentage">
                        <div className="relative">
                            <input type="number" min="0" step="0.01" value={taxRate}
                                onChange={(e) => setTaxRate(e.target.value)} placeholder="e.g. 15"
                                className={`${inputCls} pr-10`} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                        </div>
                    </Field>
                    <Field label="Price after tax">
                        <input type="number" min="0" step="0.01" value={totalPrice}
                            onChange={(e) => setTotalPrice(e.target.value)} placeholder="e.g. 115.00"
                            className={inputCls} />
                    </Field>
                </div>

                <div aria-live="polite" className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start gap-3">
                        <Calculator size={20} className="mt-0.5 text-emerald-700" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium uppercase text-emerald-700">Price before tax</p>
                            <p className="mt-1 text-3xl font-bold text-emerald-800">{cur(beforeTax)}</p>
                            {hasResult && (
                                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200 pt-3 text-sm">
                                    <div>
                                        <p className="text-xs text-gray-500">Tax amount</p>
                                        <p className="mt-0.5 font-semibold text-gray-800">{cur(taxAmount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Total after tax</p>
                                        <p className="mt-0.5 font-semibold text-gray-800">{cur(total)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}