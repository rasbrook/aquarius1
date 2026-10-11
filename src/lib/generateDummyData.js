// ============================================================
// Restaurant Cash Flow — Comprehensive Dummy Data Generator
// Run this file to generate a realistic full-year dataset
// ============================================================
// Usage: node src/lib/generateDummyData.js
// Then copy the JSON output into your browser console or localStorage
// ============================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min, max, decimals = 2) {
  const val = Math.random() * (max - min) + min
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  return d.toISOString().split('T')[0]
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const YEAR = 2026
const START_DATE = new Date(YEAR, 0, 1)   // Jan 1
const END_DATE = new Date(YEAR, 6, 27)     // July 27 (today in sim)

const MENU_ITEMS = [
  { name: 'Grilled Chicken', price: 18.00 },
  { name: 'Beef Steak', price: 32.00 },
  { name: 'Pasta Carbonara', price: 16.00 },
  { name: 'Caesar Salad', price: 12.50 },
  { name: 'Burger Combo', price: 14.00 },
  { name: 'Fish & Chips', price: 19.00 },
  { name: 'Lamb Chops', price: 28.00 },
  { name: 'Vegetable Stir Fry', price: 13.00 },
  { name: 'Seafood Platter', price: 35.00 },
  { name: 'Chicken Wings', price: 11.00 },
  { name: 'Margherita Pizza', price: 15.00 },
  { name: 'Tacos (3)', price: 12.00 },
  { name: 'Ribeye Steak', price: 38.00 },
  { name: 'Grilled Salmon', price: 26.00 },
  { name: 'Pancakes', price: 9.00 },
]

const SIDES = [
  { name: 'French Fries', price: 5.00 },
  { name: 'Mashed Potatoes', price: 6.00 },
  { name: 'Steamed Rice', price: 4.00 },
  { name: 'Garlic Bread', price: 4.50 },
  { name: 'Coleslaw', price: 3.50 },
]

const DRINKS = [
  { name: 'Lemonade', price: 4.00 },
  { name: 'Iced Tea', price: 3.50 },
  { name: 'Soda', price: 3.00 },
  { name: 'Orange Juice', price: 5.00 },
  { name: 'Coffee', price: 3.50 },
  { name: 'Red Wine (glass)', price: 9.00 },
  { name: 'Beer', price: 6.00 },
  { name: 'Sparkling Water', price: 3.00 },
]

const EXPENSE_DESCRIPTIONS = {
  food_cost: ['Weekly produce delivery', 'Meat & poultry order', 'Beverage restock', 'Dairy supply', 'Fresh seafood order', 'Bakery items', 'Spices & condiments', 'Weekly groceries', 'Frozen goods delivery', 'Organic vegetable box'],
  fuel: ['Generator diesel', 'Vehicle fuel — deliveries', 'Vehicle fuel — staff transport', 'Cooking gas refill', 'Backup generator fuel'],
  rent: ['Monthly restaurant rent', 'Storage unit rent', 'Parking space rent'],
  salaries: ['Staff payroll — 2 weeks', 'Chef salary', 'Manager salary', 'Waitstaff payroll', 'Kitchen assistant pay', 'Cleaner wages'],
  utilities: ['Electricity bill', 'Water bill', 'Internet & phone', 'Waste disposal', 'Sewer charges'],
  marketing: ['Social media ads', 'Flyer printing', 'Local newspaper ad', 'Influencer collaboration', 'Event sponsorship', 'Google Ads campaign'],
  loan_principal: ['Business loan repayment', 'Equipment loan installment', 'Property loan payment'],
  loan_interest: ['Loan interest', 'Overdraft interest', 'Credit line interest'],
  vat_paid: ['Monthly VAT remittance', 'Quarterly VAT payment', 'Tax authority VAT'],
  corporate_tax: ['Corporate tax installment', 'Estimated tax payment', 'Annual tax prepayment'],
  maintenance: ['Fridge repair', 'AC servicing', 'Exhaust hood cleaning', 'Plumbing repair', 'Electrical fix', 'Table/chair repair', 'POS system update'],
  miscellaneous: ['Office supplies', 'Uniforms', 'Cleaning supplies', 'Napkins & disposables', 'Menu printing'],
  contingency: ['Unexpected glass breakage', 'Spoilage loss', 'Refund to customer', 'Emergency repair', 'Theft/loss'],
}

// ------------------------------------------------------------
// GENERATE TRANSACTIONS
// ------------------------------------------------------------
function generateTransactions(count = 200) {
  const transactions = []
  const incomeCategories = ['sales', 'other_income']
  const expenseCategories = Object.keys(EXPENSE_DESCRIPTIONS)

  // --- Recurring: Monthly Rent (1st of month) ---
  for (let m = 0; m < 7; m++) {
    transactions.push({
      id: `tx-rent-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'rent',
      amount: 1800.00,
      description: 'Monthly restaurant rent',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-01`,
      payment_method: 'bank_transfer',
      created_at: new Date(YEAR, m, 1).toISOString(),
    })
  }

  // --- Recurring: Bi-weekly Payroll ---
  let payrollDate = new Date(YEAR, 0, 5)
  while (payrollDate <= END_DATE) {
    transactions.push({
      id: `tx-pay-${payrollDate.toISOString().split('T')[0]}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'salaries',
      amount: randomFloat(2200, 2800, 2),
      description: randomChoice(EXPENSE_DESCRIPTIONS.salaries),
      transaction_date: payrollDate.toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      created_at: payrollDate.toISOString(),
    })
    payrollDate.setDate(payrollDate.getDate() + 14)
  }

  // --- Recurring: Weekly Food Cost (Tuesdays) ---
  let foodDate = new Date(YEAR, 0, 7)
  while (foodDate <= END_DATE) {
    transactions.push({
      id: `tx-food-${foodDate.toISOString().split('T')[0]}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'food_cost',
      amount: randomFloat(280, 520, 2),
      description: randomChoice(EXPENSE_DESCRIPTIONS.food_cost),
      transaction_date: foodDate.toISOString().split('T')[0],
      payment_method: randomChoice(['cash', 'bank_transfer']),
      created_at: foodDate.toISOString(),
    })
    foodDate.setDate(foodDate.getDate() + 7)
  }

  // --- Recurring: Monthly Utilities (varied dates) ---
  for (let m = 0; m < 7; m++) {
    transactions.push({
      id: `tx-elec-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'utilities',
      amount: randomFloat(220, 340, 2),
      description: 'Electricity bill',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-${randomInt(3, 8)}`,
      payment_method: 'bank_transfer',
      created_at: new Date(YEAR, m, randomInt(3, 8)).toISOString(),
    })
    transactions.push({
      id: `tx-water-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'utilities',
      amount: randomFloat(75, 120, 2),
      description: 'Water bill',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-${randomInt(10, 15)}`,
      payment_method: 'cash',
      created_at: new Date(YEAR, m, randomInt(10, 15)).toISOString(),
    })
  }

  // --- Recurring: Monthly Loan Payment ---
  for (let m = 0; m < 7; m++) {
    transactions.push({
      id: `tx-loan-p-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'loan_principal',
      amount: 500.00,
      description: 'Business loan repayment',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-15`,
      payment_method: 'bank_transfer',
      created_at: new Date(YEAR, m, 15).toISOString(),
    })
    transactions.push({
      id: `tx-loan-i-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'loan_interest',
      amount: randomFloat(75, 95, 2),
      description: 'Loan interest',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-15`,
      payment_method: 'bank_transfer',
      created_at: new Date(YEAR, m, 15).toISOString(),
    })
  }

  // --- Recurring: Quarterly VAT & Tax ---
  for (let m of [2, 5]) { // March, June
    transactions.push({
      id: `tx-vat-${m}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: 'vat_paid',
      amount: randomFloat(300, 450, 2),
      description: 'Quarterly VAT payment',
      transaction_date: `${YEAR}-${String(m + 1).padStart(2, '0')}-20`,
      payment_method: 'bank_transfer',
      created_at: new Date(YEAR, m, 20).toISOString(),
    })
  }
  transactions.push({
    id: `tx-corp-1`,
    user_id: 'demo-user-id',
      type: 'expense',
    category: 'corporate_tax',
    amount: 420.00,
    description: 'Corporate tax installment',
    transaction_date: `${YEAR}-04-15`,
    payment_method: 'bank_transfer',
    created_at: new Date(YEAR, 3, 15).toISOString(),
  })

  // --- Daily Sales (Mon-Sat, higher on weekends) ---
  let salesDate = new Date(YEAR, 0, 1)
  while (salesDate <= END_DATE) {
    const day = salesDate.getDay()
    if (day !== 0) { // closed Sundays
      const isWeekend = day === 5 || day === 6
      const base = isWeekend ? randomFloat(800, 1800) : randomFloat(400, 1100)
      const amount = Math.round(base * 100) / 100

      transactions.push({
        id: `tx-sale-${salesDate.toISOString().split('T')[0]}`,
        user_id: 'demo-user-id',
        type: 'income',
        category: 'sales',
        amount,
        description: isWeekend ? 'Weekend service' : 'Daily sales',
        transaction_date: salesDate.toISOString().split('T')[0],
        payment_method: randomChoice(['cash', 'mobile_money', 'bank_transfer']),
        created_at: salesDate.toISOString(),
      })
    }
    salesDate.setDate(salesDate.getDate() + 1)
  }

  // --- Random one-off expenses ---
  const extraExpenses = ['fuel', 'marketing', 'maintenance', 'miscellaneous', 'contingency']
  for (let i = 0; i < 40; i++) {
    const cat = randomChoice(extraExpenses)
    const d = randomDate(START_DATE, END_DATE)
    transactions.push({
      id: `tx-rand-${i}`,
      user_id: 'demo-user-id',
      type: 'expense',
      category: cat,
      amount: randomFloat(30, 350, 2),
      description: randomChoice(EXPENSE_DESCRIPTIONS[cat]),
      transaction_date: d,
      payment_method: randomChoice(['cash', 'mobile_money', 'bank_transfer']),
      created_at: new Date(d).toISOString(),
    })
  }

  // --- Random other income ---
  for (let i = 0; i < 8; i++) {
    const d = randomDate(START_DATE, END_DATE)
    transactions.push({
      id: `tx-oinc-${i}`,
      user_id: 'demo-user-id',
      type: 'income',
      category: 'other_income',
      amount: randomFloat(50, 400, 2),
      description: randomChoice([
        'Catering deposit',
        'Private event booking',
        'Delivery platform bonus',
        'Equipment rental refund',
        'Food festival revenue',
        'Corporate lunch contract',
      ]),
      transaction_date: d,
      payment_method: randomChoice(['bank_transfer', 'mobile_money']),
      created_at: new Date(d).toISOString(),
    })
  }

  return transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
}

// ------------------------------------------------------------
// GENERATE SALES (item-level)
// ------------------------------------------------------------
function generateSales(count = 60) {
  const sales = []
  let salesDate = new Date(YEAR, 0, 1)

  for (let i = 0; i < count; i++) {
    // Skip Sundays, advance to next valid day
    while (salesDate.getDay() === 0) salesDate.setDate(salesDate.getDate() + 1)
    if (salesDate > END_DATE) break

    const numItems = randomInt(2, 5)
    const items = []
    let total = 0

    for (let j = 0; j < numItems; j++) {
      const pool = j === 0 ? MENU_ITEMS : (j === 1 ? SIDES : (j === 2 ? DRINKS : [...MENU_ITEMS, ...SIDES, ...DRINKS]))
      const item = randomChoice(pool)
      const qty = randomInt(1, 6)
      const subtotal = Math.round(item.price * qty * 100) / 100
      total += subtotal
      items.push({ name: item.name, qty, price: item.price })
    }

    total = Math.round(total * 100) / 100

    sales.push({
      id: `sale-${i}`,
      date: salesDate.toISOString().split('T')[0],
      items,
      total,
      payment_method: randomChoice(['cash', 'mobile_money', 'bank_transfer']),
      recorded_by: randomChoice(['Jane', 'Mike', 'Sarah', 'Owner']),
    })

    salesDate.setDate(salesDate.getDate() + randomInt(1, 4))
  }

  return sales.sort((a, b) => new Date(b.date) - new Date(a.date))
}

// ------------------------------------------------------------
// GENERATE BILLS
// ------------------------------------------------------------
function generateBills() {
  const bills = [
    { id: 'b1', title: 'Electricity — July', amount: 315.50, due_date: '2026-08-05', status: 'unpaid', category: 'utilities', paid_date: null },
    { id: 'b2', title: 'Water — July', amount: 98.00, due_date: '2026-08-10', status: 'unpaid', category: 'utilities', paid_date: null },
    { id: 'b3', title: 'Internet & Phone', amount: 72.00, due_date: '2026-08-12', status: 'unpaid', category: 'utilities', paid_date: null },
    { id: 'b4', title: 'Fresh Produce Supplier', amount: 485.00, due_date: '2026-08-02', status: 'unpaid', category: 'food_cost', paid_date: null },
    { id: 'b5', title: 'Insurance Premium', amount: 195.00, due_date: '2026-08-20', status: 'unpaid', category: 'miscellaneous', paid_date: null },
    { id: 'b6', title: 'Equipment Lease', amount: 320.00, due_date: '2026-07-30', status: 'unpaid', category: 'maintenance', paid_date: null },
    { id: 'b7', title: 'Gas Supplier', amount: 145.00, due_date: '2026-08-08', status: 'unpaid', category: 'utilities', paid_date: null },
    { id: 'b8', title: 'Marketing Agency', amount: 250.00, due_date: '2026-08-15', status: 'unpaid', category: 'marketing', paid_date: null },
    { id: 'b9', title: 'Electricity — June', amount: 298.00, due_date: '2026-07-05', status: 'paid', category: 'utilities', paid_date: '2026-07-03' },
    { id: 'b10', title: 'Water — June', amount: 89.50, due_date: '2026-07-10', status: 'paid', category: 'utilities', paid_date: '2026-07-08' },
    { id: 'b11', title: 'Meat Supplier', amount: 520.00, due_date: '2026-07-15', status: 'paid', category: 'food_cost', paid_date: '2026-07-14' },
    { id: 'b12', title: 'Accounting Services', amount: 180.00, due_date: '2026-07-25', status: 'paid', category: 'miscellaneous', paid_date: '2026-07-22' },
  ]
  return bills
}

// ------------------------------------------------------------
// GENERATE NOTES
// ------------------------------------------------------------
function generateNotes() {
  return [
    {
      id: 'n1',
      title: 'Staff Meeting — July 20',
      content: 'Discussed new seasonal menu. Chef proposed 3 specials: Truffle Mushroom Risotto ($24), Grilled Octopus ($29), and Peach Cobbler ($10). Need to cost ingredients before next Friday.\n\nAction items:\n- Source truffle supplier (Mike)\n- Update menu boards (Sarah)\n- Train kitchen staff on new dishes (Chef)',
      created_at: '2026-07-20T10:00:00Z',
      pinned: true,
    },
    {
      id: 'n2',
      title: 'New Meat Supplier Contact',
      content: 'Premium Butchers Ltd\nContact: James Okafor\nPhone: +233-24-XXX-XXXX\nEmail: james@premiumbutchers.gh\n\nDelivery: Tuesdays & Fridays\nMin order: $250\nPayment terms: Net 14 days\n\nPrices (per kg):\n- Beef ribeye: $18\n- Lamb chops: $22\n- Chicken breast: $8\n- Ground beef: $10',
      created_at: '2026-07-18T14:30:00Z',
      pinned: true,
    },
    {
      id: 'n3',
      title: 'Health Inspection Checklist',
      content: 'Next inspection scheduled for August 15. Must complete:\n\n✓ Deep clean kitchen exhaust hood\n✓ Service fire suppression system\n✓ Update staff health certificates\n✓ Check temperature logs (last 3 months)\n✓ Restock first aid kit\n✓ Verify pest control contract is current\n\nContact inspector: Mrs. Addo — schedule confirmation needed.',
      created_at: '2026-07-15T09:00:00Z',
      pinned: false,
    },
    {
      id: 'n4',
      title: 'Weekend Promo Idea',
      content: 'Proposal: "Family Feast Friday"\n- 4-course meal for 4 people: $85 (normally $120)\n- Includes 1 free dessert\n- Runs every Friday in August\n\nMarketing:\n- Instagram carousel (Sarah)\n- Local radio spot ($150)\n- Flyers to nearby offices\n\nProjected additional revenue: $1,200/weekend',
      created_at: '2026-07-12T16:00:00Z',
      pinned: false,
    },
    {
      id: 'n5',
      title: 'Equipment Maintenance Log',
      content: 'Last serviced:\n- Walk-in fridge: June 10 (next: Sept 10)\n- Deep fryer: June 25 (next: Aug 25)\n- AC units: May 15 (next: Aug 15) ⚠️ DUE SOON\n- Dishwasher: July 1 (next: Oct 1)\n- POS system: July 5 (software update needed)\n\nVendor: CoolTech Services — +233-27-XXX-XXXX',
      created_at: '2026-07-10T11:00:00Z',
      pinned: false,
    },
    {
      id: 'n6',
      title: 'Q3 Budget Targets',
      content: 'Revenue target: $48,000 (July-Sept)\nExpense cap: $32,000\nNet profit target: $16,000 (33% margin)\n\nKey investments:\n- Patio renovation: $3,500\n- New POS tablets (2x): $800\n- Staff bonus pool: $1,200\n\nCurrent trajectory: ON TRACK (+5% ahead)',
      created_at: '2026-07-05T08:30:00Z',
      pinned: true,
    },
    {
      id: 'n7',
      title: 'Customer Feedback Summary — July',
      content: 'Top compliments:\n1. Grilled Chicken (mentioned 23x)\n2. Service speed (mentioned 18x)\n3. Ambiance/music (mentioned 12x)\n\nComplaints to address:\n1. Wait time on weekends (avg 25 min) → add 1 weekend server\n2. Parking → negotiate with neighboring lot\n3. Portion size on salads → review plate presentation\n\nOverall rating: 4.3/5 (up from 4.1 in June)',
      created_at: '2026-07-25T13:00:00Z',
      pinned: false,
    },
  ]
}

// ------------------------------------------------------------
// GENERATE PROFILE
// ------------------------------------------------------------
function generateProfile() {
  return {
    id: 'demo-user-id',
    full_name: 'Jane Smith',
    restaurant_name: 'The Golden Spoon',
    email: 'jane@goldenspoon.com',
    created_at: '2025-01-15T08:00:00Z',
  }
}

// ------------------------------------------------------------
// MAIN OUTPUT
// ------------------------------------------------------------
const data = {
  profile: generateProfile(),
  transactions: generateTransactions(),
  sales: generateSales(),
  bills: generateBills(),
  notes: generateNotes(),
}

// Print summary
console.log('========================================')
console.log('  DUMMY DATA GENERATED SUCCESSFULLY')
console.log('========================================')
console.log(`Transactions: ${data.transactions.length}`)
console.log(`  - Income:   ${data.transactions.filter(t => t.type === 'income').length}`)
console.log(`  - Expenses: ${data.transactions.filter(t => t.type === 'expense').length}`)
console.log(`Sales records: ${data.sales.length}`)
console.log(`Bills: ${data.bills.length}`)
console.log(`Notes: ${data.notes.length}`)
console.log('')

// Calculate totals for sanity check
const totalIncome = data.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
const totalExpense = data.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
console.log(`Total Income:  $${totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
console.log(`Total Expense: $${totalExpense.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
console.log(`Net Cash Flow: $${(totalIncome - totalExpense).toLocaleString('en-US', {minimumFractionDigits: 2})}`)
console.log('')

// Export as JSON string for localStorage injection
const jsonString = JSON.stringify(data, null, 2)
console.log('--- Copy this into your browser console to load into the app: ---')
console.log(`localStorage.setItem('rcf_demo_transactions', JSON.stringify(${JSON.stringify(data.transactions)}))`)
console.log(`localStorage.setItem('rcf_demo_sales', JSON.stringify(${JSON.stringify(data.sales)}))`)
console.log(`localStorage.setItem('rcf_demo_bills', JSON.stringify(${JSON.stringify(data.bills)}))`)
console.log(`localStorage.setItem('rcf_demo_notes', JSON.stringify(${JSON.stringify(data.notes)}))`)
console.log(`localStorage.setItem('rcf_demo_user', JSON.stringify(${JSON.stringify(data.profile)}))`)
console.log('')
console.log('Then reload the page.')

// Also write to a file if running in Node
if (typeof window === 'undefined') {
  const fs = require('fs')
  const path = require('path')
  const outPath = path.join(__dirname, 'dummyData.json')
  fs.writeFileSync(outPath, jsonString)
  console.log(`\nAlso saved to: ${outPath}`)
}
