import { useEffect, useState } from 'react'
import Header from '../shared/Header'
import Icon from '../Icon'
import { supabase } from '../../supabaseClient'
import { exportToExcel } from '../../utils/exportToExcel'
import { calendarMonthOptions, schoolYearOptions } from '../Accounting/monthUtils'
import {
  resolvePeriod,
  buildGroupsReport,
  buildTeachersReport,
  buildNetProfitReport,
  buildTuitionReport,
  buildExpensesReport,
} from './reportsApi'
import './ReportsPage.css'

const REPORTS = [
  {
    key: 'groups',
    title: 'Élèves par groupe',
    description: "Liste de tous les élèves, organisés par groupe.",
    icon: 'layers',
    build: buildGroupsReport,
  },
  {
    key: 'teachers',
    title: 'Professeurs',
    description: 'Liste complète des professeurs avec rémunération.',
    icon: 'cap',
    build: buildTeachersReport,
  },
  {
    key: 'profit',
    title: 'Bénéfice net',
    description: 'Rapport financier complet (CA, charges, salaires, bénéfice).',
    icon: 'trending-up',
    build: buildNetProfitReport,
  },
  {
    key: 'tuition',
    title: 'Frais de scolarité',
    description: 'État des paiements de tous les élèves pour le mois sélectionné.',
    icon: 'wallet',
    build: buildTuitionReport,
  },
  {
    key: 'expenses',
    title: 'Charges',
    description: 'Détail des charges (manuelles, fixes récurrentes, automatiques) du mois sélectionné.',
    icon: 'coins',
    build: buildExpensesReport,
  },
]

export default function ReportsPage() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => String(new Date().getMonth() + 1))
  const [filterYear, setFilterYear] = useState('')
  const [generating, setGenerating] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('branches')
      .select('id, name')
      .order('name')
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) setError(err.message)
        else setBranches(data || [])
      })
    return () => {
      active = false
    }
  }, [])

  const monthOptions = calendarMonthOptions()
  const yearOptions = schoolYearOptions()

  const download = async (report) => {
    if (generating) return
    setGenerating(report.key)
    setError('')
    try {
      const period = resolvePeriod(filterMonth, filterYear)
      const branchName = branchId ? branches.find((b) => b.id === branchId)?.name : ''
      const { sheets, fileName } = await report.build({ branchId: branchId || null, branchName, ...period })
      exportToExcel(sheets, fileName)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Une erreur est survenue lors de la génération du rapport.')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="reports-page">
      <Header />
      <main className="reports-content">
        <div className="fees-heading">
          <h1>Bulletins</h1>
          <p>Téléchargez des rapports Excel complets sur les données du centre.</p>
        </div>

        <section className="reports-filters">
          <label className="reports-filter">
            <span>Succursale</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Toutes les succursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="reports-filter">
            <span>Mois</span>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="reports-filter">
            <span>Année</span>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="">Année scolaire en cours</option>
              {yearOptions.map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </label>
        </section>

        {error && <div className="fees-error">Erreur : {error}</div>}

        <section className="reports-grid">
          {REPORTS.map((report) => {
            const isGenerating = generating === report.key
            return (
              <article className="report-card" key={report.key}>
                <i className="report-card-icon"><Icon name={report.icon} /></i>
                <h2>{report.title}</h2>
                <p>{report.description}</p>
                <button
                  className="report-card-download"
                  disabled={Boolean(generating)}
                  onClick={() => download(report)}
                >
                  {isGenerating ? (
                    <><span className="report-spinner" /> Génération...</>
                  ) : (
                    <><Icon name="download" /> Télécharger (.xlsx)</>
                  )}
                </button>
              </article>
            )
          })}
        </section>
      </main>
    </div>
  )
}
