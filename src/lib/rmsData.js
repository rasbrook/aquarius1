// ============================================================
// RMS Data Layer — local-first store with realistic seed data
// Works standalone (demo mode). When Supabase credentials are
// configured the rest of the app can be pointed at the backend
// using supabase/rms_schema.sql.
// ============================================================
import { useEffect, useReducer } from 'react'
import { db, isDemoMode } from './supabase'

const NS = 'rms_v1'
const r2 = (n) => Math.round(Number(n) * 100) / 100
export const money = (n) => r2(n)

// ---------- seeded RNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`
const day = 24 * 3600 * 1000
const iso = (d) => new Date(d).toISOString()

// ============================================================
// STARTER STATE
// ============================================================
function createEmptyState() {
  return {
    settings: {
      restaurant: {
        name: 'Your Restaurant', address: '', phone: '', email: '', currency: 'USD', timezone: 'UTC', logo: '🍽️',
      },
      pos: {
        service_charge_pct: 0, default_payment_method: 'Cash', order_prefix: 'ORD',
        receipt_footer: 'Thank you for your visit!', tax_inclusive: false,
        require_register_for_cash: true, allow_credit: false, large_variance_threshold: 20,
      },
      inventory: { low_stock_threshold: 1, costing_method: 'FIFO', waste_pct_alert: 5 },
      loyalty: { enabled: true, points_per_currency: 1, redemption_rate: 0.05, min_redemption: 100 },
      notifications: { email: false, in_app: true, low_stock_alerts: true },
      demo_seeded_at: null,
    },
    roles: [{ id: 'role_owner', name: 'Owner', permissions: ['*'] }],
    users: [],
    branches: [],
    sections: [],
    tables: [],
    categories: [],
    products: [],
    modifier_groups: [],
    product_modifiers: {},
    ingredients: [],
    recipes: {},
    suppliers: [],
    purchase_orders: [],
    customers: [],
    employees: [],
    attendance: [],
    expenses: [],
    taxes: [],
    promotions: [],
    orders: [],
    cash_registers: [],
    register_sessions: [],
    cash_transactions: [],
    reservations: [],
    transfers: [],
    stock_counts: [],
    inventory_transactions: [],
    audit_logs: [],
    notifications: [],
    seq: { order: 0, expense: 0, po: 0 },
  }
}

function seed() {
  return createEmptyState()

  const rnd = mulberry32(20261007)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min

  const now = new Date()
  now.setMinutes(0, 0, 0)

  const settings = {
    restaurant: {
      name: 'Bella Cucina', address: '12 Harbor Street', phone: '+1 555-0100', email: 'hello@bellacucina.com',
      currency: 'USD', timezone: 'America/New_York', logo: '🍝',
    },
    pos: {
      service_charge_pct: 0, default_payment_method: 'Cash', order_prefix: 'ORD',
      receipt_footer: 'Thank you for dining with us!', tax_inclusive: false,
      require_register_for_cash: true, allow_credit: false, large_variance_threshold: 20,
    },
    inventory: { low_stock_threshold: 1, costing_method: 'FIFO', waste_pct_alert: 5 },
    loyalty: { enabled: true, points_per_currency: 1, redemption_rate: 0.05, min_redemption: 100 },
    notifications: { email: false, in_app: true, low_stock_alerts: true },
    demo_seeded_at: iso(now),
  }

  const roles = [
    { id: 'role_owner', name: 'Owner', permissions: ['*'] },
    {
      id: 'role_manager', name: 'General Manager', permissions: [
        'dashboard.view', 'pos.use', 'orders.manage', 'menu.edit', 'inventory.manage',
        'purchasing.manage', 'expenses.manage', 'cash.manage', 'reports.view',
        'employees.manage', 'customers.manage', 'promotions.manage', 'settings.view',
      ],
    },
    {
      id: 'role_cashier', name: 'Cashier', permissions: [
        'dashboard.view', 'pos.use', 'orders.create', 'cash.open', 'cash.close',
      ],
    },
    {
      id: 'role_waiter', name: 'Waiter', permissions: [
        'dashboard.view', 'orders.create', 'tables.view',
      ],
    },
    { id: 'role_kitchen', name: 'Kitchen Staff', permissions: ['kitchen.view'] },
    { id: 'role_accountant', name: 'Accountant', permissions: ['dashboard.view', 'reports.view', 'expenses.view'] },
  ]

  const users = [
    { id: 'user_admin', name: 'Alex Morgan', email: 'owner@bellacucina.com', role_id: 'role_owner', branch_ids: ['br1', 'br2'], status: 'active' },
    { id: 'user_gm', name: 'Sarah Chen', email: 'gm@bellacucina.com', role_id: 'role_manager', branch_ids: ['br1', 'br2'], status: 'active' },
    { id: 'user_cash1', name: 'John Carter', email: 'cashier@bellacucina.com', role_id: 'role_cashier', branch_ids: ['br1'], status: 'active' },
  ]

  const branches = [
    { id: 'br1', name: 'Downtown', address: '12 Harbor Street', phone: '+1 555-0100', manager: 'Sarah Chen' },
    { id: 'br2', name: 'Riverside', address: '48 River Walk', phone: '+1 555-0101', manager: 'Marco Diaz' },
  ]

  const sections = [
    { id: 'sec1', branch_id: 'br1', name: 'Main Hall' },
    { id: 'sec2', branch_id: 'br1', name: 'Terrace' },
    { id: 'sec3', branch_id: 'br2', name: 'Dining Room' },
  ]

  const tables = []
  const tableSpecs = [
    ['br1', 'sec1', [1, 2, 3, 4, 5, 6], 2, 4],
    ['br1', 'sec2', [7, 8, 9], 4, 6],
    ['br2', 'sec3', [1, 2, 3, 4, 5], 2, 4],
  ]
  tableSpecs.forEach(([br, sec, nums, minC, maxC]) => {
    nums.forEach((n, i) => {
      tables.push({
        id: uid('tbl'), branch_id: br, section_id: sec, number: n,
        capacity: ri(minC, maxC), status: 'available', current_order_id: null,
        x: (i % 3) * 180 + 20, y: Math.floor(i / 3) * 140 + 20,
      })
    })
  })

  const categories = [
    { id: 'cat_starters', name: 'Starters', sort: 1 },
    { id: 'cat_pizza', name: 'Pizza', sort: 2 },
    { id: 'cat_pasta', name: 'Pasta', sort: 3 },
    { id: 'cat_mains', name: 'Main Courses', sort: 4 },
    { id: 'cat_desserts', name: 'Desserts', sort: 5 },
    { id: 'cat_drinks', name: 'Drinks', sort: 6 },
  ]

  const P = (id, cat, name, price, cost, emoji, station, prep, tax = 0) =>
    ({ id, category_id: cat, name, description: '', sku: id.toUpperCase(), barcode: '', price, cost, emoji, station, prep_time: prep, tax_rate: tax, available: true, sort: 0 })

  const products = [
    P('prd_bruschetta', 'cat_starters', 'Bruschetta', 6.5, 1.8, '🍅', 'Main Kitchen', 8),
    P('prd_garlicbread', 'cat_starters', 'Garlic Bread', 5.0, 1.2, '🥖', 'Main Kitchen', 6),
    P('prd_calamari', 'cat_starters', 'Fried Calamari', 9.0, 2.9, '🦑', 'Fryer', 12),
    P('prd_margherita', 'cat_pizza', 'Margherita Pizza', 11.0, 3.1, '🍕', 'Pizza', 15),
    P('prd_pepperoni', 'cat_pizza', 'Pepperoni Pizza', 13.5, 3.8, '🍕', 'Pizza', 15),
    P('prd_quattro', 'cat_pizza', 'Quattro Formaggi', 14.0, 4.2, '🍕', 'Pizza', 16),
    P('prd_carbonara', 'cat_pasta', 'Spaghetti Carbonara', 12.5, 3.4, '🍝', 'Main Kitchen', 14),
    P('prd_bolognese', 'cat_pasta', 'Tagliatelle Bolognese', 13.0, 3.6, '🍝', 'Main Kitchen', 14),
    P('prd_pesto', 'cat_pasta', 'Pesto Linguine', 12.0, 3.2, '🍝', 'Main Kitchen', 12),
    P('prd_salmon', 'cat_mains', 'Grilled Salmon', 18.5, 6.4, '🐟', 'Grill', 18),
    P('prd_steak', 'cat_mains', 'Ribeye Steak', 24.0, 8.9, '🥩', 'Grill', 22),
    P('prd_chicken', 'cat_mains', 'Herb Chicken', 15.5, 4.6, '🍗', 'Grill', 18),
    P('prd_burger', 'cat_mains', 'Classic Burger', 13.0, 4.0, '🍔', 'Grill', 16),
    P('prd_tiramisu', 'cat_desserts', 'Tiramisu', 6.5, 1.6, '🍰', 'Dessert', 5),
    P('prd_panna', 'cat_desserts', 'Panna Cotta', 5.5, 1.3, '🍮', 'Dessert', 5),
    P('prd_coke', 'cat_drinks', 'Coca-Cola', 2.5, 0.5, '🥤', 'Drinks', 1, 0),
    P('prd_juice', 'cat_drinks', 'Fresh Orange Juice', 4.0, 1.1, '🧃', 'Drinks', 2),
    P('prd_beer', 'cat_drinks', 'Craft Beer', 5.5, 1.9, '🍺', 'Drinks', 1),
    P('prd_wine', 'cat_drinks', 'House Wine (glass)', 7.0, 2.6, '🍷', 'Drinks', 1),
    P('prd_espresso', 'cat_drinks', 'Espresso', 2.2, 0.4, '☕', 'Drinks', 2),
  ]

  const modifier_groups = [
    {
      id: 'mg_size', name: 'Size', required: false, min: 0, max: 1, modifiers: [
        { id: 'mod_lg', name: 'Large', price: 2 }, { id: 'mod_fam', name: 'Family', price: 5 },
      ]
    },
    {
      id: 'mg_extras', name: 'Extras', required: false, min: 0, max: 3, modifiers: [
        { id: 'mod_cheese', name: 'Extra Cheese', price: 1.5 }, { id: 'mod_bacon', name: 'Bacon', price: 2 },
        { id: 'mod_mush', name: 'Mushrooms', price: 1 },
      ]
    },
    {
      id: 'mg_cook', name: 'Cooking', required: false, min: 0, max: 1, modifiers: [
        { id: 'mod_rare', name: 'Rare', price: 0 }, { id: 'mod_med', name: 'Medium', price: 0 }, { id: 'mod_well', name: 'Well Done', price: 0 },
      ]
    },
  ]
  const product_modifiers = {
    prd_margherita: ['mg_size', 'mg_extras'], prd_pepperoni: ['mg_size', 'mg_extras'],
    prd_quattro: ['mg_size'], prd_burger: ['mg_extras', 'mg_cook'],
    prd_steak: ['mg_cook'], prd_salmon: ['mg_cook'], prd_chicken: ['mg_extras'],
  }

  const I = (id, name, unit, qty, min, cost, supplier, cat, loc) =>
    ({ id, name, unit, quantity: qty, min_qty: min, max_qty: min * 8, cost_per_unit: cost, supplier_id: supplier, category: cat, location: loc })

  const ingredients = [
    I('ing_flour', 'Flour', 'kg', 60, 15, 0.9, 'sup_doro', 'Bakery', 'Dry Store'),
    I('ing_tomato', 'Tomato Sauce', 'L', 30, 10, 2.1, 'sup_doro', 'Vegetables', 'Cold Room'),
    I('ing_cheese', 'Mozzarella', 'kg', 24, 8, 7.5, 'sup_doro', 'Dairy', 'Cold Room'),
    I('ing_beef', 'Beef Ribeye', 'kg', 15, 6, 14.0, 'sup_meatco', 'Meat', 'Freezer'),
    I('ing_chicken', 'Chicken Breast', 'kg', 20, 8, 6.2, 'sup_meatco', 'Meat', 'Freezer'),
    I('ing_salmon', 'Salmon Fillet', 'kg', 9, 4, 16.5, 'sup_ocean', 'Fish', 'Freezer'),
    I('ing_pasta', 'Dry Pasta', 'kg', 40, 12, 1.8, 'sup_doro', 'Dry Store', 'Dry Store'),
    I('ing_bacon', 'Bacon', 'kg', 8, 3, 8.0, 'sup_meatco', 'Meat', 'Cold Room'),
    I('ing_eggs', 'Eggs', 'pc', 180, 60, 0.25, 'sup_green', 'Dairy', 'Cold Room'),
    I('ing_cream', 'Cream', 'L', 12, 5, 3.4, 'sup_green', 'Dairy', 'Cold Room'),
    I('ing_lettuce', 'Lettuce', 'kg', 10, 4, 2.2, 'sup_green', 'Vegetables', 'Cold Room'),
    I('ing_bread', 'Burger Buns', 'pc', 70, 24, 0.45, 'sup_bakery', 'Bakery', 'Dry Store'),
    I('ing_coffee', 'Coffee Beans', 'kg', 6, 2, 12.0, 'sup_doro', 'Beverages', 'Dry Store'),
    I('ing_oil', 'Olive Oil', 'L', 14, 5, 6.8, 'sup_green', 'Dry Store', 'Dry Store'),
    I('ing_wine', 'House Wine', 'L', 22, 8, 5.2, 'sup_cellar', 'Beverages', 'Cellar'),
    I('ing_beer', 'Craft Beer', 'pc', 90, 36, 1.6, 'sup_cellar', 'Beverages', 'Cellar'),
    I('ing_calamari', 'Calamari Rings', 'kg', 7, 3, 7.9, 'sup_ocean', 'Fish', 'Freezer'),
    I('ing_pesto', 'Pesto Sauce', 'kg', 5, 2, 9.4, 'sup_doro', 'Dry Store', 'Cold Room'),
    I('ing_panna', 'Panna Base', 'L', 6, 2, 4.1, 'sup_green', 'Dairy', 'Cold Room'),
  ]

  const recipes = {
    prd_margherita: [{ ingredient_id: 'ing_flour', qty: 0.25 }, { ingredient_id: 'ing_tomato', qty: 0.1 }, { ingredient_id: 'ing_cheese', qty: 0.12 }],
    prd_pepperoni: [{ ingredient_id: 'ing_flour', qty: 0.25 }, { ingredient_id: 'ing_tomato', qty: 0.1 }, { ingredient_id: 'ing_cheese', qty: 0.15 }, { ingredient_id: 'ing_beef', qty: 0.03 }],
    prd_quattro: [{ ingredient_id: 'ing_flour', qty: 0.25 }, { ingredient_id: 'ing_cheese', qty: 0.2 }],
    prd_carbonara: [{ ingredient_id: 'ing_pasta', qty: 0.12 }, { ingredient_id: 'ing_eggs', qty: 2 }, { ingredient_id: 'ing_bacon', qty: 0.06 }, { ingredient_id: 'ing_cream', qty: 0.05 }],
    prd_bolognese: [{ ingredient_id: 'ing_pasta', qty: 0.12 }, { ingredient_id: 'ing_beef', qty: 0.12 }, { ingredient_id: 'ing_tomato', qty: 0.12 }],
    prd_pesto: [{ ingredient_id: 'ing_pasta', qty: 0.12 }, { ingredient_id: 'ing_pesto', qty: 0.06 }, { ingredient_id: 'ing_cheese', qty: 0.03 }],
    prd_salmon: [{ ingredient_id: 'ing_salmon', qty: 0.2 }, { ingredient_id: 'ing_oil', qty: 0.02 }, { ingredient_id: 'ing_lettuce', qty: 0.05 }],
    prd_steak: [{ ingredient_id: 'ing_beef', qty: 0.3 }, { ingredient_id: 'ing_oil', qty: 0.02 }],
    prd_chicken: [{ ingredient_id: 'ing_chicken', qty: 0.25 }, { ingredient_id: 'ing_oil', qty: 0.02 }, { ingredient_id: 'ing_lettuce', qty: 0.05 }],
    prd_burger: [{ ingredient_id: 'ing_bread', qty: 1 }, { ingredient_id: 'ing_beef', qty: 0.15 }, { ingredient_id: 'ing_cheese', qty: 0.03 }, { ingredient_id: 'ing_lettuce', qty: 0.03 }],
    prd_bruschetta: [{ ingredient_id: 'ing_bread', qty: 2 }, { ingredient_id: 'ing_tomato', qty: 0.08 }, { ingredient_id: 'ing_oil', qty: 0.01 }],
    prd_garlicbread: [{ ingredient_id: 'ing_bread', qty: 1 }, { ingredient_id: 'ing_oil', qty: 0.02 }],
    prd_calamari: [{ ingredient_id: 'ing_calamari', qty: 0.15 }, { ingredient_id: 'ing_oil', qty: 0.05 }],
    prd_tiramisu: [{ ingredient_id: 'ing_eggs', qty: 1 }, { ingredient_id: 'ing_cream', qty: 0.08 }],
    prd_panna: [{ ingredient_id: 'ing_panna', qty: 0.12 }],
    prd_coke: [], prd_juice: [], prd_beer: [{ ingredient_id: 'ing_beer', qty: 1 }], prd_wine: [{ ingredient_id: 'ing_wine', qty: 0.15 }], prd_espresso: [{ ingredient_id: 'ing_coffee', qty: 0.01 }],
  }

  const suppliers = [
    { id: 'sup_doro', name: 'Doro Foods', contact: 'Emma Rossi', phone: '+1 555-2001', email: 'sales@dorofoods.com', address: '8 Market Lane', tax_id: 'TX-88213', terms: 'Net 14', balance: 1240.5 },
    { id: 'sup_meatco', name: 'Prime Meat Co.', contact: 'Frank Miller', phone: '+1 555-2002', email: 'orders@primemeat.com', address: '33 Industrial Rd', tax_id: 'TX-77120', terms: 'Net 7', balance: 860.0 },
    { id: 'sup_green', name: 'Green Valley Produce', contact: 'Lily Adams', phone: '+1 555-2003', email: 'hello@greenvalley.com', address: '5 Farm Road', tax_id: 'TX-90341', terms: 'COD', balance: 0 },
    { id: 'sup_ocean', name: 'Ocean Fresh Seafood', contact: 'Tom Becker', phone: '+1 555-2004', email: 'sales@oceanfresh.com', address: '2 Pier Avenue', tax_id: 'TX-66278', terms: 'Net 7', balance: 430.75 },
    { id: 'sup_bakery', name: 'Daily Crust Bakery', contact: 'Nina Park', phone: '+1 555-2005', email: 'bake@dailycrust.com', address: '19 Oak Street', tax_id: 'TX-55401', terms: 'Net 30', balance: 210.0 },
    { id: 'sup_cellar', name: 'Cellar & Hops', contact: 'Victor Lang', phone: '+1 555-2006', email: 'trade@cellarhops.com', address: '77 Vine Blvd', tax_id: 'TX-44190', terms: 'Net 14', balance: 1560.2 },
  ]

  const customers = []
  const custNames = ['Maria Garcia', 'James Wilson', 'Aisha Khan', 'Robert Brown', 'Elena Petrova', 'David Lee', 'Sofia Rossi', 'Michael Scott', 'Anna Novak', 'Chris Evans', 'Laura Kim', 'Daniel Craig', 'Grace Hopper', 'Henry Ford', 'Isla Fisher', 'Jack Ryan', 'Nora Jones', 'Omar Sy', 'Paula Abdul', 'Quentin Blake']
  custNames.forEach((name, i) => {
    const visits = ri(2, 40)
    const aov = 15 + rnd() * 35
    customers.push({
      id: uid('cus'), name, phone: `+1 555-${String(1000 + i * 7).padStart(4, '0')}`,
      email: name.toLowerCase().replace(' ', '.') + '@example.com',
      birthday: `19${ri(65, 95)}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
      address: '', points: ri(0, 800), visits, total_spent: r2(visits * aov), last_visit: iso(now - ri(0, 30) * day),
      segment: visits > 25 ? 'VIP' : visits > 10 ? 'Frequent' : 'Regular',
    })
  })

  const employees = [
    { id: 'emp1', name: 'Sarah Chen', employee_no: 'E001', phone: '+1 555-3001', email: 'sarah@bellacucina.com', role: 'General Manager', department: 'Management', branch_id: 'br1', hire_date: '2021-03-15', salary: 5200, status: 'active' },
    { id: 'emp2', name: 'John Carter', employee_no: 'E002', phone: '+1 555-3002', email: 'john@bellacucina.com', role: 'Cashier', department: 'Front of House', branch_id: 'br1', hire_date: '2022-06-01', salary: 2600, status: 'active' },
    { id: 'emp3', name: 'Elena Petrova', employee_no: 'E003', phone: '+1 555-3003', email: 'elena@bellacucina.com', role: 'Waiter', department: 'Front of House', branch_id: 'br1', hire_date: '2023-01-20', salary: 2200, status: 'active' },
    { id: 'emp4', name: 'Marco Diaz', employee_no: 'E004', phone: '+1 555-3004', email: 'marco@bellacucina.com', role: 'Branch Manager', department: 'Management', branch_id: 'br2', hire_date: '2020-11-02', salary: 4800, status: 'active' },
    { id: 'emp5', name: 'Priya Nair', employee_no: 'E005', phone: '+1 555-3005', email: 'priya@bellacucina.com', role: 'Chef', department: 'Kitchen', branch_id: 'br1', hire_date: '2019-08-12', salary: 3800, status: 'active' },
    { id: 'emp6', name: 'Tom Becker', employee_no: 'E006', phone: '+1 555-3006', email: 'tom@bellacucina.com', role: 'Kitchen Staff', department: 'Kitchen', branch_id: 'br1', hire_date: '2024-02-05', salary: 2100, status: 'active' },
    { id: 'emp7', name: 'Anna Novak', employee_no: 'E007', phone: '+1 555-3007', email: 'anna@bellacucina.com', role: 'Inventory Manager', department: 'Inventory', branch_id: 'br1', hire_date: '2022-09-19', salary: 3000, status: 'active' },
    { id: 'emp8', name: 'David Lee', employee_no: 'E008', phone: '+1 555-3008', email: 'david@bellacucina.com', role: 'Accountant', department: 'Finance', branch_id: 'br1', hire_date: '2021-05-30', salary: 4200, status: 'active' },
  ]

  const taxes = [
    { id: 'tax1', name: 'Sales Tax', rate: 8.5, inclusive: false, effective_date: '2024-01-01', branches: ['br1', 'br2'], active: true },
    { id: 'tax2', name: 'VAT (Drinks)', rate: 10, inclusive: false, effective_date: '2024-01-01', branches: ['br1', 'br2'], active: false },
  ]

  const promotions = [
    { id: 'prm1', name: 'Happy Hour Beer', type: 'percentage', value: 20, scope: 'product', product_ids: ['prd_beer', 'prd_wine'], code: '', start: iso(now - 20 * day), end: iso(now + 10 * day), active: true, times_redeemed: 34 },
    { id: 'prm2', name: 'Weekday Lunch 10% Off', type: 'percentage', value: 10, scope: 'order', code: 'LUNCH10', start: iso(now - 40 * day), end: iso(now + 50 * day), active: true, times_redeemed: 112 },
    { id: 'prm3', name: 'Family Pizza Deal', type: 'fixed', value: 5, scope: 'category', category_ids: ['cat_pizza'], code: 'FAMILY', start: iso(now - 10 * day), end: iso(now + 5 * day), active: true, times_redeemed: 21 },
  ]

  // ------- generated historical orders (45 days) -------
  const orders = []
  let orderSeq = 1000
  const paymentMethods = ['Cash', 'Card', 'Mobile Money', 'Bank Transfer']
  const orderTypes = ['dine_in', 'takeaway', 'delivery', 'pickup']
  const productPool = products.filter((p) => p.id !== 'prd_wine' || rnd() > 0.3)

  for (let d = 45; d >= 0; d--) {
    const date = new Date(now.getTime() - d * day)
    const dow = date.getDay()
    const baseCount = dow === 5 || dow === 6 ? ri(26, 38) : ri(12, 22)
    for (let k = 0; k < baseCount; k++) {
      const isToday = d === 0
      const created = new Date(date); created.setHours(ri(10, 21), ri(0, 59), ri(0, 59), 0)
      if (isToday && created > now) continue
      const type = pick(orderTypes)
      const nItems = ri(1, 4)
      const items = []
      for (let j = 0; j < nItems; j++) {
        const p = pick(productPool)
        if (items.find((i) => i.product_id === p.id)) continue
        const qty = ri(1, 3)
        items.push({ product_id: p.id, name: p.name, price: p.price, qty, modifiers: [], notes: '' })
      }
      if (!items.length) continue
      const subtotal = r2(items.reduce((s, i) => s + i.price * i.qty, 0))
      const promo = rnd() < 0.08 ? promotions[1] : null
      const discount = promo ? r2(subtotal * (promo.value / 100)) : 0
      const taxRate = taxes[0].rate
      const tax = r2(((subtotal - discount) * taxRate) / 100)
      const total = r2(subtotal - discount + tax)
      const method = type === 'online' ? 'Card' : pick(paymentMethods)
      orderSeq++
      const status = 'completed'
      const cid = rnd() < 0.7 ? pick(customers).id : null
      const openTables = tables.filter((t) => t.branch_id === 'br1')
      orders.push({
        id: uid('ord'), number: `${settings.pos.order_prefix}-${orderSeq}`,
        branch_id: 'br1', table_id: type === 'dine_in' ? pick(openTables).id : null,
        customer_id: cid, waiter_id: pick(['emp3', 'emp3', 'emp2']).employee_id || 'emp3',
        type, status, payment_status: 'paid', held: false,
        items, subtotal, discount, discount_code: promo?.code || '', tax, tax_rate: taxRate,
        service_charge: 0, total, tip: rnd() < 0.15 ? ri(2, 8) : 0,
        payments: [{ method, amount: total, reference: `PAY-${orderSeq}` }],
        created_at: iso(created), completed_at: iso(new Date(created.getTime() + ri(18, 55) * 60000)),
        completed_by: 'pos', source: 'pos', notes: '',
      })
    }
  }

  // a few live orders for kitchen / tables
  const liveSpecs = [
    { type: 'dine_in', status: 'preparing' }, { type: 'dine_in', status: 'new' },
    { type: 'dine_in', status: 'ready' }, { type: 'takeaway', status: 'new' },
    { type: 'delivery', status: 'accepted' },
  ]
  liveSpecs.forEach((spec, i) => {
    const p1 = products[i + 6], p2 = products[i + 11]
    const items = [
      { product_id: p1.id, name: p1.name, price: p1.price, qty: 1, modifiers: [{ name: 'Extra Cheese', price: 1.5 }], notes: 'No onions' },
      { product_id: p2.id, name: p2.name, price: p2.price, qty: 2, modifiers: [], notes: '' },
    ]
    const subtotal = r2(items.reduce((s, it) => s + (it.price + it.modifiers.reduce((m, x) => m + x.price, 0)) * it.qty, 0))
    const tax = r2((subtotal * taxes[0].rate) / 100)
    const total = r2(subtotal + tax)
    orderSeq++
    const table = tables[i]
    const order = {
      id: uid('ord'), number: `${settings.pos.order_prefix}-${orderSeq}`, branch_id: 'br1',
      table_id: spec.type === 'dine_in' ? table.id : null, customer_id: null,
      waiter_id: 'emp3', type: spec.type, status: spec.status,
      payment_status: 'unpaid', held: false, items, subtotal, discount: 0, discount_code: '',
      tax, tax_rate: taxes[0].rate, service_charge: 0, total, tip: 0, payments: [],
      created_at: iso(new Date(now.getTime() - ri(4, 40) * 60000)), completed_at: null,
      completed_by: '', source: 'pos', notes: '',
    }
    orders.push(order)
    if (table) { table.status = 'occupied'; table.current_order_id = order.id }
  })

  // expenses
  const expenseCategories = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Maintenance', 'Transportation', 'Cleaning', 'Food Purchases', 'Equipment', 'Internet', 'Insurance', 'Taxes', 'Miscellaneous']
  const expenses = []
  let expSeq = 500
  for (let d = 45; d >= 0; d -= 1) {
    const date = new Date(now.getTime() - d * day)
    if (date.getDate() === 1) {
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: 'Rent', description: 'Monthly rent — Downtown', amount: 3200, date: iso(date), payment_method: 'Bank Transfer', branch_id: 'br1', employee_id: 'emp1', status: 'approved', created_by: 'Alex Morgan' })
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: 'Salaries', description: 'Payroll', amount: ri(18000, 22000), date: iso(date), payment_method: 'Bank Transfer', branch_id: 'br1', employee_id: 'emp1', status: 'approved', created_by: 'Alex Morgan' })
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: 'Insurance', description: 'Business insurance', amount: 450, date: iso(date), payment_method: 'Card', branch_id: 'br1', employee_id: 'emp1', status: 'approved', created_by: 'Alex Morgan' })
    }
    if (d % 7 === 0) {
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: 'Food Purchases', description: 'Weekly produce order', amount: ri(400, 900), date: iso(date), payment_method: pick(['Cash', 'Card', 'Bank Transfer']), branch_id: 'br1', employee_id: 'emp7', status: 'approved', created_by: 'Anna Novak' })
    }
    if (d % 3 === 0) {
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: 'Utilities', description: 'Electricity & water', amount: ri(80, 260), date: iso(date), payment_method: 'Bank Transfer', branch_id: 'br1', employee_id: 'emp1', status: 'approved', created_by: 'Alex Morgan' })
    }
    if (rnd() < 0.15) {
      expenses.push({ id: uid('exp'), number: `EXP-${++expSeq}`, category: pick(['Marketing', 'Maintenance', 'Cleaning', 'Transportation', 'Miscellaneous']), description: pick(['Social media ads', 'Plumbing fix', 'Deep cleaning service', 'Supplier delivery fee', 'Office supplies']), amount: ri(30, 350), date: iso(date), payment_method: pick(['Cash', 'Card']), branch_id: 'br1', employee_id: 'emp1', status: rnd() < 0.7 ? 'approved' : 'pending', created_by: pick(['Alex Morgan', 'Sarah Chen']) })
    }
  }

  // attendance (last 7 days)
  const attendance = []
  for (let d = 7; d >= 1; d--) {
    const date = new Date(now.getTime() - d * day)
    employees.filter((e) => e.status === 'active' && e.role !== 'Owner').forEach((e) => {
      if (rnd() < 0.06) return // absence
      const late = rnd() < 0.12
      const inH = e.department === 'Kitchen' ? 8 : 9
      const clockIn = new Date(date); clockIn.setHours(inH, late ? ri(10, 45) : ri(0, 5), 0, 0)
      const clockOut = new Date(date); clockOut.setHours(inH + 9, ri(0, 59), 0, 0)
      attendance.push({
        id: uid('att'), employee_id: e.id, date: iso(date).slice(0, 10),
        clock_in: iso(clockIn), clock_out: iso(clockOut),
        breaks: [{ start: iso(new Date(date).setHours(inH + 4, 0, 0, 0) && new Date(date.setHours(inH + 4, 0, 0, 0))), end: iso(new Date(date).setHours(inH + 4, 30, 0, 0) && new Date(date.setHours(inH + 4, 30, 0, 0))) }],
        status: late ? 'late' : 'present',
      })
    })
  }

  // cash registers & sessions
  const cash_registers = [
    { id: 'reg1', branch_id: 'br1', name: 'Register 1' },
    { id: 'reg2', branch_id: 'br1', name: 'Register 2' },
    { id: 'reg3', branch_id: 'br2', name: 'Register 1' },
  ]
  const register_sessions = []
  const cash_transactions = []
  for (let d = 7; d >= 1; d--) {
    const date = new Date(now.getTime() - d * day)
    const dayOrders = orders.filter((o) => {
      const c = new Date(o.created_at)
      return c.getFullYear() === date.getFullYear() && c.getMonth() === date.getMonth() && c.getDate() === date.getDate() && o.payment_status === 'paid'
    })
    const cashSales = r2(dayOrders.reduce((s, o) => s + o.payments.filter((p) => p.method === 'Cash').reduce((a, p) => a + p.amount, 0), 0))
    const opening = 200
    register_sessions.push({
      id: uid('ses'), register_id: 'reg1', cashier: 'John Carter', opened_at: iso(new Date(date.setHours(8, 45, 0, 0))),
      opening_cash: opening, status: 'closed', closed_at: iso(new Date(date.setHours(22, 15, 0, 0))),
      closing_cash: opening + cashSales + ri(-8, 8), expected_cash: opening + cashSales,
      variance: 0, approved_by: '',
    })
    if (rnd() < 0.4) cash_transactions.push({ id: uid('ct'), session_id: register_sessions[register_sessions.length - 1].id, type: 'out', amount: ri(20, 120), reason: 'Petty cash', reference: `CT-${d}1`, notes: 'Supplies', user: 'John Carter', created_at: iso(new Date(date).setHours(14, 0, 0, 0) && new Date(date.setHours(14, 0, 0, 0))) })
  }
  // open session for today
  const todayCashSales = r2(orders.filter((o) => o.payment_status === 'paid' && new Date(o.created_at).toDateString() === now.toDateString()).reduce((s, o) => s + o.payments.filter((p) => p.method === 'Cash').reduce((a, p) => a + p.amount, 0), 0))
  register_sessions.push({
    id: 'ses_today', register_id: 'reg1', cashier: 'John Carter', opened_at: iso(new Date(now.getTime() - 6 * 3600 * 1000)),
    opening_cash: 250, status: 'open', closed_at: null, closing_cash: null,
    expected_cash: r2(250 + todayCashSales), variance: null, approved_by: '',
  })

  // purchase orders
  const purchase_orders = [
    { id: uid('po'), number: 'PO-1001', supplier_id: 'sup_meatco', branch_id: 'br1', status: 'received', items: [{ ingredient_id: 'ing_beef', qty: 10, price: 14 }, { ingredient_id: 'ing_chicken', qty: 12, price: 6.2 }], tax: 0, discount: 0, total: 214.4, payment_status: 'paid', created_at: iso(now - 12 * day), received_at: iso(now - 11 * day) },
    { id: uid('po'), number: 'PO-1002', supplier_id: 'sup_doro', branch_id: 'br1', status: 'sent', items: [{ ingredient_id: 'ing_flour', qty: 25, price: 0.9 }, { ingredient_id: 'ing_cheese', qty: 10, price: 7.5 }, { ingredient_id: 'ing_tomato', qty: 15, price: 2.1 }], tax: 0, discount: 0, total: 139.5, payment_status: 'unpaid', created_at: iso(now - 2 * day), received_at: null },
    { id: uid('po'), number: 'PO-1003', supplier_id: 'sup_cellar', branch_id: 'br1', status: 'draft', items: [{ ingredient_id: 'ing_wine', qty: 24, price: 5.2 }, { ingredient_id: 'ing_beer', qty: 48, price: 1.6 }], tax: 0, discount: 0, total: 201.6, payment_status: 'unpaid', created_at: iso(now - 1 * day), received_at: null },
  ]

  const reservations = [
    { id: uid('rsv'), customer_name: 'Grace Hopper', phone: '+1 555-14', date: iso(now).slice(0, 10), time: '19:00', guests: 4, table_id: tables[1].id, status: 'confirmed', special_request: 'Window seat', branch_id: 'br1' },
    { id: uid('rsv'), customer_name: 'Omar Sy', phone: '+1 555-15', date: iso(now + day).slice(0, 10), time: '20:30', guests: 2, table_id: null, status: 'pending', special_request: '', branch_id: 'br1' },
    { id: uid('rsv'), customer_name: 'Nora Jones', phone: '+1 555-16', date: iso(now + day).slice(0, 10), time: '13:00', guests: 6, table_id: null, status: 'confirmed', special_request: 'Birthday dessert', branch_id: 'br1' },
  ]

  const transfers = [
    { id: uid('trf'), from_branch: 'br1', to_branch: 'br2', items: [{ ingredient_id: 'ing_cheese', qty: 2 }], status: 'received', date: iso(now - 5 * day), user: 'Anna Novak' },
    { id: uid('trf'), from_branch: 'br2', to_branch: 'br1', items: [{ ingredient_id: 'ing_beer', qty: 12 }], status: 'shipped', date: iso(now - 1 * day), user: 'Marco Diaz' },
  ]

  const stock_counts = []

  const inventory_transactions = []
  orders.filter((o) => o.status === 'completed').slice(-60).forEach((o) => {
    o.items.forEach((it) => {
      const rec = recipes[it.product_id] || []
      rec.forEach((r) => {
        inventory_transactions.push({ id: uid('itx'), ingredient_id: r.ingredient_id, type: 'sale', qty: -r.qty * it.qty, reason: `Order ${o.number}`, ref: o.number, user: 'POS', created_at: o.completed_at })
      })
    })
  })

  const audit_logs = [
    { id: uid('aud'), user: 'Alex Morgan', action: 'create', entity: 'promotion', entity_id: 'prm1', prev: '', new: 'Happy Hour Beer', created_at: iso(now - 20 * day) },
    { id: uid('aud'), user: 'Sarah Chen', action: 'update', entity: 'product', entity_id: 'prd_steak', prev: '$22.00', new: '$24.00', created_at: iso(now - 8 * day) },
    { id: uid('aud'), user: 'John Carter', action: 'cancel', entity: 'order', entity_id: 'ORD-1011', prev: 'confirmed', new: 'cancelled', created_at: iso(now - 6 * day) },
    { id: uid('aud'), user: 'Anna Novak', action: 'adjust', entity: 'inventory', entity_id: 'ing_wine', prev: '22 L', new: '20 L', created_at: iso(now - 3 * day) },
  ]

  const notifications = [
    { id: uid('ntf'), type: 'low_stock', message: 'Low stock: Salmon Fillet (9 kg remaining, min 4 kg)', read: false, created_at: iso(now - 3600 * 1000) },
    { id: uid('ntf'), type: 'order', message: 'New order ORD-1003 received', read: false, created_at: iso(now - 1800 * 1000) },
    { id: uid('ntf'), type: 'expense', message: 'Expense #EXP-505 awaiting approval', read: true, created_at: iso(now - 2 * 3600 * 1000) },
    { id: uid('ntf'), type: 'po', message: 'Purchase order PO-1002 sent to Doro Foods', read: true, created_at: iso(now - 2 * day) },
  ]

  return {
    settings, roles, users, branches, sections, tables, categories, products,
    modifier_groups, product_modifiers, ingredients, recipes, suppliers,
    purchase_orders, customers, employees, attendance, expenses, taxes,
    promotions, orders, cash_registers, register_sessions, cash_transactions,
    reservations, transfers, stock_counts, inventory_transactions, audit_logs,
    notifications, seq: { order: orderSeq, expense: expSeq, po: 1003 },
  }
}

// ============================================================
// STORE
// ============================================================
let state = null
const listeners = new Set()
let ownerId = null
let syncStatus = isDemoMode ? 'local' : 'connecting'
let revision = 0
let lastSavedRevision = -1
let cloudUpdatedAt = null
let cloudBaseline = null
let saveTimeout = null
let syncInterval = null
let saveInFlight = null

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function recordKey(value) {
  if (!value || typeof value !== 'object') return null
  return value.id ?? value.ingredient_id ?? value.key ?? null
}

function mergeRecords(base, local, remote) {
  const result = cloneValue(remote)
  const resultByKey = new Map(result.map((row, index) => [recordKey(row), index]))
  const baseByKey = new Map(base.map((row) => [recordKey(row), row]))
  const localByKey = new Map(local.map((row) => [recordKey(row), row]))

  baseByKey.forEach((baseRow, key) => {
    const localRow = localByKey.get(key)
    const remoteIndex = resultByKey.get(key)
    if (localRow === undefined) {
      if (remoteIndex !== undefined) {
        result.splice(remoteIndex, 1)
        resultByKey.clear()
        result.forEach((row, index) => resultByKey.set(recordKey(row), index))
      }
      return
    }
    if (!sameValue(baseRow, localRow)) {
      if (remoteIndex === undefined) {
        resultByKey.set(key, result.length)
        result.push(cloneValue(localRow))
      } else {
        result[remoteIndex] = mergeConcurrent(baseRow, localRow, result[remoteIndex])
      }
    }
  })

  localByKey.forEach((localRow, key) => {
    if (!baseByKey.has(key) && !resultByKey.has(key)) {
      resultByKey.set(key, result.length)
      result.push(cloneValue(localRow))
    }
  })
  return result
}

function mergeConcurrent(base, local, remote) {
  if (sameValue(local, base)) return cloneValue(remote)
  if (sameValue(remote, base)) return cloneValue(local)

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const keyed = [...base, ...local, ...remote].every((value) => recordKey(value) !== null)
    if (keyed) return mergeRecords(base, local, remote)
    if ([...base, ...local, ...remote].every((value) => typeof value !== 'object' || value === null)) {
      const baseValues = new Set(base)
      const localValues = new Set(local)
      return [...remote.filter((value) => !baseValues.has(value) || localValues.has(value)), ...local.filter((value) => !baseValues.has(value) && !remote.includes(value))]
    }
    return cloneValue(local)
  }

  if (base && local && remote && [base, local, remote].every((value) => typeof value === 'object' && !Array.isArray(value))) {
    const result = {}
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
    keys.forEach((key) => {
      const baseHas = Object.prototype.hasOwnProperty.call(base, key)
      const localHas = Object.prototype.hasOwnProperty.call(local, key)
      const remoteHas = Object.prototype.hasOwnProperty.call(remote, key)
      if (!localHas && !remoteHas) return
      if (!localHas) {
        if (!baseHas || sameValue(remote[key], base[key])) return
        return
      }
      if (!remoteHas) {
        if (!baseHas || !sameValue(local[key], base[key])) result[key] = cloneValue(local[key])
        return
      }
      result[key] = mergeConcurrent(base[key], local[key], remote[key])
    })
    return result
  }

  return cloneValue(local)
}

function normalizeState(value) {
  const defaults = createEmptyState()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults
  return {
    ...defaults,
    ...value,
    settings: {
      ...defaults.settings,
      ...value.settings,
      restaurant: { ...defaults.settings.restaurant, ...value.settings?.restaurant },
      pos: { ...defaults.settings.pos, ...value.settings?.pos },
      inventory: { ...defaults.settings.inventory, ...value.settings?.inventory },
      loyalty: { ...defaults.settings.loyalty, ...value.settings?.loyalty },
      notifications: { ...defaults.settings.notifications, ...value.settings?.notifications },
    },
    seq: { ...defaults.seq, ...value.seq },
  }
}

function persistLocal() {
  try { localStorage.setItem(NS, JSON.stringify(state)) } catch (error) {
    console.error('Unable to save local restaurant data:', error)
  }
}

function emit() {
  listeners.forEach((listener) => listener())
}

function scheduleCloudSave() {
  if (!ownerId || isDemoMode) return
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => { void flushRMS() }, 700)
}

async function flushRMS() {
  if (!ownerId || isDemoMode || !state) return
  if (saveInFlight) return saveInFlight

  const savingOwner = ownerId
  syncStatus = 'saving'
  emit()

  saveInFlight = (async () => {
    let conflicts = 0
    while (savingOwner === ownerId) {
      const savingRevision = revision
      const snapshot = cloneValue(state)
      let request = db('restaurants')
        .update({ rms_data: snapshot, updated_at: new Date().toISOString() })
        .eq('owner_id', savingOwner)
      if (cloudUpdatedAt) request = request.eq('updated_at', cloudUpdatedAt)
      const { data, error } = await request.select('updated_at')
      if (savingOwner !== ownerId) return
      if (error) throw error

      if (data?.length) {
        cloudUpdatedAt = data[0].updated_at
        cloudBaseline = cloneValue(snapshot)
        lastSavedRevision = savingRevision
        if (revision === savingRevision) {
          syncStatus = 'saved'
          emit()
          return
        }
        conflicts = 0
        continue
      }

      const { data: latestRows, error: loadError } = await db('restaurants')
        .select('rms_data, updated_at')
        .eq('owner_id', savingOwner)
      if (savingOwner !== ownerId) return
      if (loadError) throw loadError
      const latest = Array.isArray(latestRows) ? latestRows[0] : latestRows
      if (!latest) throw new Error('No restaurant row is available for this account.')

      const remoteState = normalizeState(latest.rms_data)
      const localState = cloneValue(state)
      state = mergeConcurrent(cloudBaseline || createEmptyState(), localState, remoteState)
      cloudBaseline = cloneValue(remoteState)
      cloudUpdatedAt = latest.updated_at
      revision += 1
      persistLocal()
      emit()
      conflicts += 1
      if (conflicts >= 5) throw new Error('Restaurant data is changing on another device. Changes were merged locally; retrying the database save shortly.')
    }
  })()

  try {
    await saveInFlight
  } catch (error) {
    console.error('Unable to save restaurant data:', error)
    syncStatus = 'error'
    emit()
    if (ownerId === savingOwner) {
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => { void flushRMS() }, 2000)
    }
  } finally {
    saveInFlight = null
  }
}

function load() {
  try {
    const raw = localStorage.getItem(NS)
    if (raw) return normalizeState(JSON.parse(raw))
  } catch (error) {
    console.error('Unable to restore local restaurant data:', error)
  }
  return createEmptyState()
}

export function getState() {
  if (!state) state = load()
  return state
}

export function update(mutator) {
  const s = getState()
  const result = mutator(s)
  revision += 1
  persistLocal()
  scheduleCloudSave()
  emit()
  return result
}

export async function initializeRMS(userId, remoteState, updatedAt = null) {
  ownerId = userId
  if (isDemoMode) {
    syncStatus = 'local'
    getState()
    emit()
    return
  }

  syncStatus = 'connecting'
  emit()
  state = remoteState && Object.keys(remoteState).length
    ? normalizeState(remoteState)
    : createEmptyState()
  cloudBaseline = cloneValue(state)
  cloudUpdatedAt = updatedAt
  revision += 1
  lastSavedRevision = remoteState && Object.keys(remoteState).length ? revision : -1
  persistLocal()
  emit()

  if (!syncInterval) {
    syncInterval = setInterval(() => { void flushRMS() }, 3 * 60 * 1000)
  }

  if (remoteState && Object.keys(remoteState).length) {
    syncStatus = 'saved'
    emit()
  } else {
    await flushRMS()
  }
}

export function reportRMSLoadError(error) {
  console.error('Unable to load restaurant data:', error)
  syncStatus = 'error'
  emit()
}

export async function disconnectRMS() {
  clearTimeout(saveTimeout)
  if (saveInFlight) await saveInFlight
  if (revision !== lastSavedRevision) await flushRMS()
  ownerId = null
  clearInterval(syncInterval)
  syncInterval = null
  syncStatus = isDemoMode ? 'local' : 'connecting'
  emit()
}

export function useRMSPersistence() {
  const [, force] = useReducer((value) => value + 1, 0)
  useEffect(() => {
    const listener = () => force()
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, [])
  return syncStatus
}

export function resetDemoData() {
  if (!isDemoMode) return
  const empty = createEmptyState()
  state = empty
  revision += 1
  persistLocal()
  scheduleCloudSave()
  emit()
}

export function useRMS() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const l = () => force()
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
  return getState()
}

// ============================================================
// DOMAIN HELPERS
// ============================================================
export const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n) || 0)

export function nextNumber(s, kind) {
  if (kind === 'order') return `${s.settings.pos.order_prefix}-${++s.seq.order}`
  if (kind === 'expense') return `EXP-${++s.seq.expense}`
  if (kind === 'po') return `PO-${++s.seq.po}`
  return `${kind.toUpperCase()}-${Date.now()}`
}

export function logAudit(s, { user = 'Demo User', action, entity, entity_id, prev = '', new: next = '' }) {
  s.audit_logs.unshift({ id: uid('aud'), user, action, entity, entity_id, prev, new: next, created_at: new Date().toISOString() })
}

export function notify(s, type, message) {
  s.notifications.unshift({ id: uid('ntf'), type, message, read: false, created_at: new Date().toISOString() })
}

export function recipeCost(s, productId) {
  const rec = s.recipes[productId] || []
  return r2(rec.reduce((sum, r) => {
    const ing = s.ingredients.find((i) => i.id === r.ingredient_id)
    return sum + (ing ? ing.cost_per_unit * r.qty : 0)
  }, 0))
}

export function productCost(s, p) {
  return p.cost > 0 ? p.cost : recipeCost(s, p.id)
}

// Compute order totals from items + discounts + tax (single source of truth)
export function computeTotals(s, { items, discount = 0, discount_code = '', tax_rate = null, service_charge_pct = null }) {
  const subtotal = r2(items.reduce((sum, it) => {
    const mods = (it.modifiers || []).reduce((m, x) => m + (Number(x.price) || 0), 0)
    return sum + (it.price + mods) * it.qty
  }, 0))
  let d = r2(Math.min(discount, subtotal))
  const rate = tax_rate ?? (s.taxes.find((t) => t.active)?.rate ?? 0)
  const tax = r2(((subtotal - d) * rate) / 100)
  const scPct = service_charge_pct ?? s.settings.pos.service_charge_pct ?? 0
  const service_charge = r2(((subtotal - d) * scPct) / 100)
  return { subtotal, discount: d, discount_code, tax, tax_rate: rate, service_charge, total: r2(subtotal - d + tax + service_charge) }
}

// Complete an order: payment, inventory deduction, customer spend/loyalty, table release
export function completeOrder(s, order, { user = 'POS', applyLoyalty = true } = {}) {
  const o = s.orders.find((x) => x.id === order.id)
  if (!o) return { error: 'Order not found' }
  if (o.payment_status !== 'paid' && !s.settings.pos.allow_credit) return { error: 'Order cannot be completed without payment' }
  if (o.status === 'completed') return { error: 'Order already completed' }
  o.status = 'completed'
  o.completed_at = new Date().toISOString()
  o.completed_by = user
  // inventory deduction from recipes
  o.items.forEach((it) => {
    const rec = s.recipes[it.product_id] || []
    rec.forEach((r) => {
      const ing = s.ingredients.find((i) => i.id === r.ingredient_id)
      if (!ing) return
      const qty = r.qty * it.qty
      ing.quantity = Math.max(0, r2(ing.quantity - qty))
      s.inventory_transactions.unshift({ id: uid('itx'), ingredient_id: ing.id, type: 'sale', qty: -qty, reason: `Order ${o.number}`, ref: o.number, user, created_at: o.completed_at })
      if (ing.quantity <= ing.min_qty) notify(s, 'low_stock', `Low stock: ${ing.name} (${ing.quantity} ${ing.unit} remaining, min ${ing.min_qty})`)
    })
  })
  // customer spend & loyalty
  if (o.customer_id) {
    const c = s.customers.find((x) => x.id === o.customer_id)
    if (c) {
      c.total_spent = r2(c.total_spent + o.total)
      c.visits += 1
      c.last_visit = o.completed_at
      if (s.settings.loyalty.enabled && applyLoyalty) c.points += Math.floor(o.total * s.settings.loyalty.points_per_currency)
    }
  }
  // release table
  if (o.table_id) {
    const t = s.tables.find((x) => x.id === o.table_id)
    if (t && t.current_order_id === o.id) { t.status = 'cleaning'; t.current_order_id = null }
  }
  logAudit(s, { user, action: 'complete', entity: 'order', entity_id: o.number, prev: o.status, new: 'completed' })
  return { data: o }
}

export function cancelOrder(s, orderId, { user = 'Demo User', reason = '' } = {}) {
  const o = s.orders.find((x) => x.id === orderId)
  if (!o) return { error: 'Order not found' }
  if (o.status === 'completed') return { error: 'Completed orders must be refunded, not cancelled' }
  const prev = o.status
  o.status = 'cancelled'
  if (o.table_id) {
    const t = s.tables.find((x) => x.id === o.table_id)
    if (t && t.current_order_id === o.id) { t.status = 'available'; t.current_order_id = null }
  }
  logAudit(s, { user, action: 'cancel', entity: 'order', entity_id: o.number, prev, new: `cancelled${reason ? ': ' + reason : ''}` })
  notify(s, 'order', `Order ${o.number} was cancelled`)
  return { data: o }
}

export function openRegister(s, { register_id, cashier, opening_cash }) {
  const existing = s.register_sessions.find((x) => x.register_id === register_id && x.status === 'open')
  if (existing) return { error: 'Register already has an open session' }
  const ses = { id: uid('ses'), register_id, cashier, opened_at: new Date().toISOString(), opening_cash: r2(opening_cash), status: 'open', closed_at: null, closing_cash: null, expected_cash: null, variance: null, approved_by: '' }
  s.register_sessions.unshift(ses)
  logAudit(s, { user: cashier, action: 'open', entity: 'register_session', entity_id: ses.id, new: `Opening cash ${fmt(opening_cash, s.settings.restaurant.currency)}` })
  return { data: ses }
}

export function registerExpectedCash(s, session) {
  const cashSales = s.orders.filter((o) => o.payment_status === 'paid' && o.payments.some((p) => p.method === 'Cash'))
    .reduce((sum, o) => sum + o.payments.filter((p) => p.method === 'Cash').reduce((a, p) => a + p.amount, 0), 0)
  const flows = s.cash_transactions.filter((t) => t.session_id === session.id)
  const cashIn = flows.filter((t) => t.type === 'in').reduce((s2, t) => s2 + t.amount, 0)
  const cashOut = flows.filter((t) => t.type === 'out').reduce((s2, t) => s2 + t.amount, 0)
  // approximate: only count cash sales while session was open
  const opened = new Date(session.opened_at).getTime()
  const closed = session.closed_at ? new Date(session.closed_at).getTime() : Date.now()
  const sessionCashSales = s.orders
    .filter((o) => {
      const t = new Date(o.created_at).getTime()
      return t >= opened && t <= closed && o.payment_status === 'paid'
    })
    .reduce((sum, o) => sum + o.payments.filter((p) => p.method === 'Cash').reduce((a, p) => a + p.amount, 0), 0)
  void cashSales
  return r2(session.opening_cash + sessionCashSales + cashIn - cashOut)
}

export function closeRegister(s, sessionId, { actual_cash, user }) {
  const ses = s.register_sessions.find((x) => x.id === sessionId)
  if (!ses || ses.status !== 'open') return { error: 'No open session' }
  const expected = registerExpectedCash(s, ses)
  const actual = r2(actual_cash)
  const variance = r2(actual - expected)
  ses.status = 'closed'
  ses.closed_at = new Date().toISOString()
  ses.closing_cash = actual
  ses.expected_cash = expected
  ses.variance = variance
  const threshold = s.settings.pos.large_variance_threshold ?? 20
  ses.approved_by = Math.abs(variance) >= threshold ? 'NEEDS_MANAGER_APPROVAL' : user
  logAudit(s, { user, action: 'close', entity: 'register_session', entity_id: ses.id, prev: fmt(expected, s.settings.restaurant.currency), new: `actual ${fmt(actual, s.settings.restaurant.currency)} (variance ${fmt(variance, s.settings.restaurant.currency)})` })
  if (Math.abs(variance) >= threshold) notify(s, 'cash_variance', `Large cash variance on register close: ${fmt(variance, s.settings.restaurant.currency)}`)
  return { data: ses, variance }
}

export function receivePurchaseOrder(s, poId, { user = 'Inventory Manager' } = {}) {
  const po = s.purchase_orders.find((x) => x.id === poId)
  if (!po) return { error: 'PO not found' }
  if (!['sent', 'approved', 'partially_received'].includes(po.status)) return { error: `PO cannot be received while ${po.status}` }
  if (!Array.isArray(po.items) || !po.items.length) return { error: 'Purchase order has no items' }
  const receipts = po.items.map((item) => ({
    item,
    ingredient: s.ingredients.find((ingredient) => ingredient.id === item.ingredient_id),
    quantity: Number(item.qty),
    unitPrice: Number(item.price),
  }))
  if (receipts.some(({ ingredient, quantity, unitPrice }) => !ingredient || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0)) {
    return { error: 'Purchase order contains an invalid ingredient, quantity, or price' }
  }

  const receivedAt = new Date().toISOString()
  receipts.forEach(({ ingredient, quantity, unitPrice }) => {
    const existingValue = Number(ingredient.quantity) * Number(ingredient.cost_per_unit)
    const receivedValue = quantity * unitPrice
    const newQuantity = Number(ingredient.quantity) + quantity
    ingredient.quantity = r2(newQuantity)
    if (newQuantity > 0) ingredient.cost_per_unit = r2((existingValue + receivedValue) / newQuantity)
    s.inventory_transactions.unshift({ id: uid('itx'), ingredient_id: ingredient.id, type: 'purchase', qty: quantity, cost: r2(receivedValue), reason: `PO ${po.number}`, ref: po.number, user, created_at: receivedAt })
  })
  po.status = 'received'
  po.received_at = receivedAt
  po.payment_status = po.payment_status === 'paid' ? 'paid' : 'unpaid'
  logAudit(s, { user, action: 'receive', entity: 'purchase_order', entity_id: po.number, new: 'received' })
  return { data: po }
}

export function lowStockItems(s) {
  return s.ingredients.filter((i) => i.quantity <= i.min_qty)
}

export const ORDER_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'refunded']
export const ORDER_STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700', accepted: 'bg-indigo-100 text-indigo-700',
  preparing: 'bg-orange-100 text-orange-700', ready: 'bg-emerald-100 text-emerald-700',
  served: 'bg-teal-100 text-teal-700', completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700', refunded: 'bg-purple-100 text-purple-700',
  pending: 'bg-amber-100 text-amber-700', draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
}
export const PAYMENT_STATUS_COLORS = { paid: 'bg-emerald-100 text-emerald-700', unpaid: 'bg-amber-100 text-amber-700', partially_paid: 'bg-orange-100 text-orange-700', refunded: 'bg-purple-100 text-purple-700' }
export const TABLE_STATUS_COLORS = {
  available: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  occupied: 'bg-red-50 border-red-300 text-red-700',
  reserved: 'bg-amber-50 border-amber-300 text-amber-700',
  cleaning: 'bg-blue-50 border-blue-300 text-blue-700',
  out_of_service: 'bg-gray-100 border-gray-300 text-gray-500',
}
export const ORDER_TYPE_LABELS = { dine_in: 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery', pickup: 'Pickup', online: 'Online' }
