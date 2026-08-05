import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/SideBar/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import Login from './components/Login/Login'
import Branches from './components/Branches/Branches'
import Users from './components/Users/Users'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Settings from './components/Settings/Settings'
import Teachers from './components/Teachers/TeachersPage'
import Groups from './components/Groups/GroupsPage'
import Students from './components/Students/StudentsPage'
import FeesPage from './components/Accounting/FeesPage'
import DelinquenciesPage from './components/Accounting/DelinquenciesPage'
import SalariesPage from './components/Accounting/SalariesPage'
import ExpensesPage from './components/Accounting/ExpensesPage'

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
      { label: 'Paramètres', icon: 'settings', path: '/settings', requiredPerm: 'settings' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Utilisateurs', icon: 'users', path: '/users', requiredPerm: 'administration' },
      { label: 'Succursales', icon: 'building', path: '/branches', requiredPerm: 'administration' },
    ],
  },
]

const metrics = [
  {
    title: 'CA du mois',
    value: '23 100 DH',
    note: '16 700 DH encaissé · 6 400 DH dû',
    tone: 'blue',
  },
  {
    title: 'Élèves en retard',
    value: '8',
    note: 'paiements impayés',
    tone: 'red',
  },
  {
    title: 'Total élèves',
    value: '40',
    note: '36 actifs',
    tone: 'slate',
  },
  {
    title: 'Professeurs',
    value: '4',
    note: '5 au total',
    tone: 'slate',
  },
  {
    title: 'Bénéfice net',
    value: '-34 000 DH',
    note: 'ce mois',
    tone: 'danger',
  },
]

const revenueSeries = [23000, 23000, 23500, 24600, 23900, 23200, 23100]
const branches = [
  { name: 'Nord', revenue: 6800, profit: -22000 },
  { name: 'Sud', revenue: 6200, profit: -15500 },
  { name: 'Centre', revenue: 6800, profit: 3500 },
]

function DashboardLayout() {
  return (
    <div className="dashboard-shell">
      <Sidebar sections={sidebarSections} />
      <Routes>
        <Route path="/dashboard" element={<Dashboard metrics={metrics} revenueSeries={revenueSeries} branches={branches} />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/users" element={<Users />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/students" element={<Students />} />
        <Route path="/accounting/fees" element={<FeesPage />} />
        <Route path="/accounting/delinquencies" element={<DelinquenciesPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Dashboard metrics={metrics} revenueSeries={revenueSeries} branches={branches} />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard metrics={metrics} revenueSeries={revenueSeries} branches={branches} />} />
              <Route path="/students" element={<ProtectedRoute requiredPerm="students"><Students /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute requiredPerm="groups"><Groups /></ProtectedRoute>} />
              <Route path="/teachers" element={<ProtectedRoute requiredPerm="teachers"><Teachers /></ProtectedRoute>} />
              <Route path="/accounting/fees" element={<ProtectedRoute requiredPerm="tuition"><FeesPage /></ProtectedRoute>} />
              <Route path="/accounting/delinquencies" element={<ProtectedRoute requiredPerm="late_payments"><DelinquenciesPage /></ProtectedRoute>} />
              <Route path="/accounting/salaries" element={<ProtectedRoute requiredPerm="teacher_salaries"><SalariesPage /></ProtectedRoute>} />
              <Route path="/accounting/expenses" element={<ProtectedRoute requiredPerm="expenses"><ExpensesPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requiredPerm="settings"><Settings /></ProtectedRoute>} />
              <Route path="/branches" element={<ProtectedRoute requiredPerm="administration"><Branches /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredPerm="administration"><Users /></ProtectedRoute>} />
              <Route path="*" element={<Dashboard metrics={metrics} revenueSeries={revenueSeries} branches={branches} />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App