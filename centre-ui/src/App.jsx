import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/SideBar/Sidebar'
import Icon from './components/Icon'
import Dashboard from './components/Dashboard/Dashboard'
import Login from './components/login/Login'
import Branches from './components/Branches/Branches'
import Users from './components/Users/Users'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BranchProvider } from './context/BranchContext'
import ProtectedRoute from './components/ProtectedRoute'
import NoAccess from './components/NoAccess'
import Settings from './components/Settings/Settings'
import Teachers from './components/Teachers/TeachersPage'
import Groups from './components/Groups/GroupsPage'
import Students from './components/Students/StudentsPage'
import FeesPage from './components/Accounting/FeesPage'
import DelinquenciesPage from './components/Accounting/DelinquenciesPage'
import SalariesPage from './components/Accounting/SalariesPage'
import ExpensesPage from './components/Accounting/ExpensesPage'
import NetProfitPage from './components/Accounting/NetProfitPage'
import ReportsPage from './components/Reports/ReportsPage'
import { firstAllowedPath } from './permissionRoutes'

const sidebarSections = [
  {
    title: 'Navigation',
    items: [
      { label: 'Dashboard', icon: 'grid', path: '/dashboard', requiredPerm: 'dashboard' },
      { label: 'Étudiants', icon: 'users', path: '/students', requiredPerm: 'students' },
      { label: 'Groupes', icon: 'layers', path: '/groups', requiredPerm: 'groups' },
      { label: 'Professeurs', icon: 'cap', path: '/teachers', requiredPerm: 'teachers' },
      {
        label: 'Comptabilité',
        icon: 'calculator',
        path: '/accounting',
        requiredPerm: ['tuition', 'late_payments', 'teacher_salaries', 'expenses', 'net_profit'],
        children: [
          { label: 'Frais de scolarité', path: '/accounting/fees', requiredPerm: 'tuition' },
          { label: 'Retards & Impayés', path: '/accounting/delinquencies', requiredPerm: 'late_payments' },
          { label: 'Salaires Profs', path: '/accounting/salaries', requiredPerm: 'teacher_salaries' },
          { label: 'Charges', path: '/accounting/expenses', requiredPerm: 'expenses' },
          { label: 'Bénéfice net', path: '/accounting/profit', requiredPerm: 'net_profit' },
        ],
      },
      { label: 'Bulletins', icon: 'clipboard', path: '/reports', requiredPerm: 'reports' },
      { label: 'Paramètres', icon: 'settings', path: '/settings', requiredPerm: 'settings' },
    ],
  },
  {
    title: 'Administration',
    separated: true,
    items: [
      { label: 'Utilisateurs', icon: 'users', path: '/users', requiredPerm: 'administration' },
      { label: 'Succursales', icon: 'building', path: '/branches', requiredPerm: 'administration' },
    ],
  },
]

function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="dashboard-shell">
      <button
        type="button"
        className="menu-toggle"
        aria-label="Ouvrir le menu de navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Icon name="menu" />
      </button>

      <div
        className={`sidebar-backdrop${menuOpen ? ' is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <Sidebar sections={sidebarSections} open={menuOpen} onNavigate={closeMenu} />
      <Outlet />
    </div>
  )
}

function CatchAllRedirect() {
  const { permissions } = useAuth()
  return <Navigate to={firstAllowedPath(permissions)} replace />
}

function App() {
  return (
    <AuthProvider>
      <BranchProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<ProtectedRoute requiredPerm="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="/students" element={<ProtectedRoute requiredPerm="students"><Students /></ProtectedRoute>} />
                <Route path="/groups" element={<ProtectedRoute requiredPerm="groups"><Groups /></ProtectedRoute>} />
                <Route path="/teachers" element={<ProtectedRoute requiredPerm="teachers"><Teachers /></ProtectedRoute>} />
                <Route path="/accounting/fees" element={<ProtectedRoute requiredPerm="tuition"><FeesPage /></ProtectedRoute>} />
                <Route path="/accounting/delinquencies" element={<ProtectedRoute requiredPerm="late_payments"><DelinquenciesPage /></ProtectedRoute>} />
                <Route path="/accounting/salaries" element={<ProtectedRoute requiredPerm="teacher_salaries"><SalariesPage /></ProtectedRoute>} />
                <Route path="/accounting/expenses" element={<ProtectedRoute requiredPerm="expenses"><ExpensesPage /></ProtectedRoute>} />
                <Route path="/accounting/profit" element={<ProtectedRoute requiredPerm="net_profit"><NetProfitPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute requiredPerm="reports"><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute requiredPerm="settings"><Settings /></ProtectedRoute>} />
                <Route path="/branches" element={<ProtectedRoute requiredPerm="administration"><Branches /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute requiredPerm="administration"><Users /></ProtectedRoute>} />
                <Route path="/no-access" element={<NoAccess />} />
                <Route path="*" element={<CatchAllRedirect />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </BranchProvider>
    </AuthProvider>
  )
}

export default App
