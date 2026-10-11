// Demo/seed data for restaurant cash flow
// Used when Supabase is not configured (developer preview mode)

export const DEMO_PROFILE = {
  id: 'demo-user-id',
  full_name: 'Jane Smith',
  restaurant_name: 'The Golden Spoon',
  currency: 'USD',
  email: 'jane@goldenspoon.com',
  created_at: '2025-01-15T08:00:00Z',
}

export const DEMO_RESTAURANT = {
  id: 'demo-restaurant-id',
  owner_id: 'demo-user-id',
  name: 'The Golden Spoon',
  logo: '🍽️',
  address: '',
  phone: '',
  email: 'jane@goldenspoon.com',
  currency: 'USD',
  timezone: 'UTC',
  pos_settings: {},
  inventory_settings: {},
  loyalty_settings: {},
  notification_settings: {},
  taxes: [],
  roles: [{ id: 'role_owner', name: 'Owner', permissions: ['*'] }],
  users: [],
}

function randomDate(monthsBack = 6) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - Math.floor(Math.random() * monthsBack), Math.floor(Math.random() * 28) + 1)
  return d.toISOString().split('T')[0]
}

export const DEMO_TRANSACTIONS = [
  // Income
  { id: 't1', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1200.00, description: 'Daily lunch sales', transaction_date: randomDate(0), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't2', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1850.50, description: 'Weekend dinner rush', transaction_date: randomDate(0), payment_method: 'mobile_money', created_at: new Date().toISOString() },
  { id: 't3', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 950.00, description: 'Breakfast service', transaction_date: randomDate(1), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't4', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 2100.00, description: 'Friday night specials', transaction_date: randomDate(1), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't5', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1600.00, description: 'Catering order - corporate', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't6', user_id: 'demo-user-id', type: 'income', category: 'other_income', amount: 300.00, description: 'Equipment rental refund', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't7', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1340.00, description: 'Daily sales', transaction_date: randomDate(3), payment_method: 'mobile_money', created_at: new Date().toISOString() },
  { id: 't8', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1780.00, description: 'Weekend brunch', transaction_date: randomDate(3), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't9', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 920.00, description: 'Monday lunch', transaction_date: randomDate(4), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't10', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 2450.00, description: 'Holiday weekend', transaction_date: randomDate(4), payment_method: 'mobile_money', created_at: new Date().toISOString() },
  { id: 't11', user_id: 'demo-user-id', type: 'income', category: 'sales', amount: 1150.00, description: 'Tuesday service', transaction_date: randomDate(5), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't12', user_id: 'demo-user-id', type: 'income', category: 'other_income', amount: 150.00, description: 'Delivery platform bonus', transaction_date: randomDate(5), payment_method: 'bank_transfer', created_at: new Date().toISOString() },

  // Expenses
  { id: 't13', user_id: 'demo-user-id', type: 'expense', category: 'food_cost', amount: 450.00, description: 'Weekly produce delivery', transaction_date: randomDate(0), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't14', user_id: 'demo-user-id', type: 'expense', category: 'food_cost', amount: 320.50, description: 'Meat & poultry order', transaction_date: randomDate(0), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't15', user_id: 'demo-user-id', type: 'expense', category: 'salaries', amount: 2400.00, description: 'Staff payroll - 2 weeks', transaction_date: randomDate(0), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't16', user_id: 'demo-user-id', type: 'expense', category: 'rent', amount: 1800.00, description: 'Monthly restaurant rent', transaction_date: randomDate(0), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't17', user_id: 'demo-user-id', type: 'expense', category: 'utilities', amount: 280.00, description: 'Electricity bill', transaction_date: randomDate(0), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't18', user_id: 'demo-user-id', type: 'expense', category: 'utilities', amount: 95.00, description: 'Water bill', transaction_date: randomDate(1), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't19', user_id: 'demo-user-id', type: 'expense', category: 'fuel', amount: 120.00, description: 'Generator diesel', transaction_date: randomDate(1), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't20', user_id: 'demo-user-id', type: 'expense', category: 'marketing', amount: 200.00, description: 'Social media ads', transaction_date: randomDate(1), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't21', user_id: 'demo-user-id', type: 'expense', category: 'food_cost', amount: 380.00, description: 'Beverage restock', transaction_date: randomDate(2), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't22', user_id: 'demo-user-id', type: 'expense', category: 'salaries', amount: 2400.00, description: 'Staff payroll - 2 weeks', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't23', user_id: 'demo-user-id', type: 'expense', category: 'loan_principal', amount: 500.00, description: 'Business loan repayment', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't24', user_id: 'demo-user-id', type: 'expense', category: 'loan_interest', amount: 85.00, description: 'Loan interest', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't25', user_id: 'demo-user-id', type: 'expense', category: 'vat_paid', amount: 340.00, description: 'Monthly VAT remittance', transaction_date: randomDate(2), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't26', user_id: 'demo-user-id', type: 'expense', category: 'corporate_tax', amount: 420.00, description: 'Corporate tax installment', transaction_date: randomDate(3), payment_method: 'bank_transfer', created_at: new Date().toISOString() },
  { id: 't27', user_id: 'demo-user-id', type: 'expense', category: 'maintenance', amount: 150.00, description: 'Fridge repair', transaction_date: randomDate(3), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't28', user_id: 'demo-user-id', type: 'expense', category: 'food_cost', amount: 410.00, description: 'Weekly groceries', transaction_date: randomDate(3), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't29', user_id: 'demo-user-id', type: 'expense', category: 'marketing', amount: 150.00, description: 'Flyer printing', transaction_date: randomDate(4), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't30', user_id: 'demo-user-id', type: 'expense', category: 'contingency', amount: 75.00, description: 'Unexpected glass breakage', transaction_date: randomDate(4), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't31', user_id: 'demo-user-id', type: 'expense', category: 'miscellaneous', amount: 45.00, description: 'Office supplies', transaction_date: randomDate(5), payment_method: 'cash', created_at: new Date().toISOString() },
  { id: 't32', user_id: 'demo-user-id', type: 'expense', category: 'fuel', amount: 110.00, description: 'Vehicle fuel - deliveries', transaction_date: randomDate(5), payment_method: 'cash', created_at: new Date().toISOString() },
]

export const DEMO_SALES = [
  { id: 's1', user_id: 'demo-user-id', date: randomDate(0), items: [{ name: 'Grilled Chicken', qty: 12, price: 18.00 }, { name: 'Caesar Salad', qty: 8, price: 12.50 }, { name: 'Lemonade', qty: 15, price: 4.00 }], total: 376.00, payment_method: 'cash', recorded_by: 'Jane' },
  { id: 's2', user_id: 'demo-user-id', date: randomDate(0), items: [{ name: 'Beef Steak', qty: 6, price: 32.00 }, { name: 'Mashed Potatoes', qty: 6, price: 8.00 }, { name: 'Red Wine', qty: 4, price: 22.00 }], total: 320.00, payment_method: 'mobile_money', recorded_by: 'Jane' },
  { id: 's3', user_id: 'demo-user-id', date: randomDate(1), items: [{ name: 'Pancakes', qty: 20, price: 9.00 }, { name: 'Orange Juice', qty: 18, price: 5.00 }, { name: 'Coffee', qty: 25, price: 3.50 }], total: 342.50, payment_method: 'cash', recorded_by: 'Jane' },
  { id: 's4', user_id: 'demo-user-id', date: randomDate(1), items: [{ name: 'Pasta Carbonara', qty: 10, price: 16.00 }, { name: 'Tiramisu', qty: 8, price: 10.00 }], total: 240.00, payment_method: 'bank_transfer', recorded_by: 'Jane' },
  { id: 's5', user_id: 'demo-user-id', date: randomDate(2), items: [{ name: 'Burger Combo', qty: 15, price: 14.00 }, { name: 'Fries', qty: 15, price: 5.00 }, { name: 'Soda', qty: 15, price: 3.00 }], total: 330.00, payment_method: 'mobile_money', recorded_by: 'Jane' },
]

export const DEMO_BILLS = [
  { id: 'b1', user_id: 'demo-user-id', title: 'Electricity - July', amount: 280.00, due_date: '2026-08-05', status: 'paid', category: 'utilities', paid_date: '2026-07-25' },
  { id: 'b2', user_id: 'demo-user-id', title: 'Water - July', amount: 95.00, due_date: '2026-08-10', status: 'paid', category: 'utilities', paid_date: '2026-07-20' },
  { id: 'b3', user_id: 'demo-user-id', title: 'Internet & Phone', amount: 65.00, due_date: '2026-08-15', status: 'unpaid', category: 'utilities', paid_date: null },
  { id: 'b4', user_id: 'demo-user-id', title: 'Supplier - Fresh Produce', amount: 450.00, due_date: '2026-08-02', status: 'unpaid', category: 'food_cost', paid_date: null },
  { id: 'b5', user_id: 'demo-user-id', title: 'Insurance Premium', amount: 180.00, due_date: '2026-08-20', status: 'unpaid', category: 'miscellaneous', paid_date: null },
]

export const DEMO_NOTES = [
  { id: 'n1', user_id: 'demo-user-id', title: 'Staff Meeting Notes', content: 'Discussed new menu items. Chef proposed 3 seasonal specials. Need to cost them before next week.', created_at: '2026-07-20T10:00:00Z', pinned: true },
  { id: 'n2', user_id: 'demo-user-id', title: 'Supplier Contact', content: 'New meat supplier: +233-XX-XXXX-XXXX. Delivery on Tuesdays and Fridays. Minimum order $200.', created_at: '2026-07-18T14:30:00Z', pinned: false },
  { id: 'n3', user_id: 'demo-user-id', title: 'Maintenance Reminder', content: 'Deep clean kitchen exhaust hood. Schedule before health inspection in August.', created_at: '2026-07-15T09:00:00Z', pinned: false },
]
