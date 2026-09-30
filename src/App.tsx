import './styles/redesign.css'
import { Route, Routes } from 'react-router-dom'
import { SiteHeader } from './components/SiteHeader'
import { CheckoutPage } from './pages/CheckoutPage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { PaymentPage } from './pages/PaymentPage'
import { AdminPage } from './pages/AdminPage'
import { TicketPage } from './pages/TicketPage'
import { VerifyPage } from './pages/VerifyPage'
import { AdminManagePage } from './pages/AdminManagePage'
import { HomePage } from './pages/HomePage'
import { TicketsPage } from './pages/TicketsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ScrollProgress } from './components/ScrollProgress'
import { useLocation } from 'react-router-dom'

export function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <div className={isAdmin ? 'site-shell admin-shell' : 'site-shell guest-shell'}>
      <SiteHeader />
      {!isAdmin && <ScrollProgress />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/reset-password" element={<AuthPage />} />
        <Route path="/update-password" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/ticket/:id" element={<TicketPage />} />
        <Route path="/verify/:ticketCode" element={<VerifyPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/orders" element={<AdminPage />} />
        <Route path="/admin/tickets" element={<AdminPage />} />
        <Route path="/admin/event" element={<AdminManagePage />} />
        <Route path="/admin/settings" element={<AdminManagePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <footer className={isAdmin ? 'site-footer admin-footer' : 'site-footer guest-footer'}>
        <span>THE TAKE OVER</span><span>ABODMAZINE TV × EKSU BRO</span><span>CLUB LUNA · EKSU</span>
      </footer>
    </div>
  )
}