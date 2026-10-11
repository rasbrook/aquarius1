import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import SalesEntry from './pages/SalesEntry'
import Transactions from './pages/Transactions'
import Reports from './pages/Reports'
import NotesBills from './pages/NotesBills'
import SettingsPage from './pages/SettingsPage'
import PosPage from './pages/PosPage'
import OrdersPage from './pages/OrdersPage'
import TablesPage from './pages/TablesPage'
import KitchenPage from './pages/KitchenPage'
import ReservationsPage from './pages/ReservationsPage'
import MenuPage from './pages/MenuPage'
import InventoryPage from './pages/InventoryPage'
import PurchasingPage from './pages/PurchasingPage'
import SuppliersPage from './pages/SuppliersPage'
import CustomersPage from './pages/CustomersPage'
import EmployeesPage from './pages/EmployeesPage'
import CashPage from './pages/CashPage'
import ExpensesPage from './pages/ExpensesPage'
import SalesReportsPage from './pages/SalesReportsPage'
import PnlPage from './pages/PnlPage'
import AnalyticsPage from './pages/AnalyticsPage'
import PromotionsPage from './pages/PromotionsPage'
import BranchesPage from './pages/BranchesPage'
import NotificationsPage from './pages/NotificationsPage'
import AuditPage from './pages/AuditPage'
import TaxCalculatorPage from './pages/TaxCalculatorPage'

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/purchasing" element={<PurchasingPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/cash" element={<CashPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports" element={<SalesReportsPage />} />
          <Route path="/pnl" element={<PnlPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/tax-calculator" element={<TaxCalculatorPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          {/* Legacy pages kept for existing data entry flows */}
          <Route path="/sales" element={<SalesEntry />} />
          <Route path="/notes-bills" element={<NotesBills />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
