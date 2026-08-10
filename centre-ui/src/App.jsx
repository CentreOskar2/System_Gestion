import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/SideBar/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import Login from './components/Login/Login'
import Branches from './components/Branches/Branches'
import Users from './components/Users/Users'
import Settings from './components/Settings/Settings'
import Teachers from './components/Teachers/TeachersPage'
import Groups from './components/Groups/GroupsPage'
import Students from './components/Students/StudentsPage'
import FeesPage from './components/Accounting/FeesPage'
import DelinquenciesPage from './components/Accounting/DelinquenciesPage'
import SalariesPage from './components/Accounting/SalariesPage'
import ExpensesPage from './components/Accounting/ExpensesPage'
import ProfitPage from './components/Accounting/ProfitPage'

const sidebarSections = [
  {
    title: 'Navigation',
    items: [
      { label: 'Dashboard', icon: 'grid', path: '/dashboard' },
      { label: 'Étudiants', icon: 'users', path: '/students' },
      { label: 'Groupes', icon: 'layers', path: '/groups' },
      { label: 'Professeurs', icon: 'cap', path: '/teachers' },
      {
        label: 'Comptabilité',
        icon: 'calculator',
        path: '/accounting',
        children: [
          { label: 'Frais de scolarité', path: '/accounting/fees' },
          { label: 'Retards & Impayés', path: '/accounting/delinquencies' },
          { label: 'Salaires Profs', path: '/accounting/salaries' },
          { label: 'Charges', path: '/accounting/expenses' },
          { label: 'Bénéfice net', path: '/accounting/profit' },
        ],
      },
      { label: 'Paramètres', icon: 'settings', path: '/settings' },
    ],
  },
  {
    title: 'Administration',
    separated: true,
    items: [
      { label: 'Utilisateurs', icon: 'users', path: '/users' },
      { label: 'Succursales', icon: 'building', path: '/branches' },
    ],
  },
]

const metrics = [
  {
    id: 'revenue',
    title: 'CA du mois',
    value: '23 100 DH',
    note: '16 700 DH encaissé · 6 400 DH dû',
    tone: 'blue',
    icon: 'trending-up',
  },
  {
    title: 'Élèves en retard',
    value: '8',
    note: 'paiements impayés',
    tone: 'red',
    icon: 'alert',
  },
  {
    title: 'Total élèves',
    value: '40',
    note: '36 actifs',
    tone: 'slate',
    icon: 'users',
  },
  {
    title: 'Professeurs',
    value: '4',
    note: '5 au total',
    tone: 'slate',
    icon: 'cap',
  },
  {
    title: 'Bénéfice net',
    value: '-34 000 DH',
    note: 'ce mois',
    tone: 'danger',
    icon: 'wallet',
  },
]

// Chiffre d'affaires par mois de l'année scolaire (encaissé = déjà payé, le reste est dû).
const monthlySeries = [
  { month: 'Septembre', revenue: 23000, collected: 17300 },
  { month: 'Octobre', revenue: 23500, collected: 18100 },
  { month: 'Novembre', revenue: 24600, collected: 19400 },
  { month: 'Décembre', revenue: 23900, collected: 18200 },
  { month: 'Janvier', revenue: 23200, collected: 17500 },
  { month: 'Février', revenue: 23100, collected: 16700 },
  { month: 'Mars', revenue: 24200, collected: 18600 },
  { month: 'Avril', revenue: 24800, collected: 19100 },
  { month: 'Mai', revenue: 25100, collected: 19800 },
  { month: 'Juin', revenue: 22400, collected: 21000 },
]

const schoolYears = ['2024-2025', '2025-2026', '2026-2027']

const branches = [
  { name: 'Nord', revenue: 6800, profit: -22000 },
  { name: 'Sud', revenue: 6200, profit: -15500 },
  { name: 'Centre', revenue: 6800, profit: 3500 },
]

function DashboardLayout() {
  const dashboard = (
    <Dashboard metrics={metrics} monthlySeries={monthlySeries} schoolYears={schoolYears} branches={branches} />
  )

  return (
    <div className="dashboard-shell">
      <Sidebar sections={sidebarSections} />
      <Routes>
        <Route path="/dashboard" element={dashboard} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/users" element={<Users />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/students" element={<Students />} />
        <Route path="/accounting/fees" element={<FeesPage />} />
        <Route path="/accounting/delinquencies" element={<DelinquenciesPage />} />
        <Route path="/accounting/salaries" element={<SalariesPage />} />
        <Route path="/accounting/expenses" element={<ExpensesPage />} />
        <Route path="/accounting/profit" element={<ProfitPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={dashboard} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<DashboardLayout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
