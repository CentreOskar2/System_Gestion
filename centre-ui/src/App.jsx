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
    items: [
      { label: 'Utilisateurs', icon: 'users', path: '/users' },
      { label: 'Succursales', icon: 'building', path: '/branches' },
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
        <Route path="/accounting/salaries" element={<SalariesPage />} />
        <Route path="/accounting/expenses" element={<ExpensesPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Dashboard metrics={metrics} revenueSeries={revenueSeries} branches={branches} />} />
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
