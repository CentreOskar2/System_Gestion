import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Eye } from 'lucide-react'
import { accountingDayBucket, formatAccountingDay, formatFrenchDate } from './monthUtils'
import { fetchAccountingUsers } from './feesApi'

// Historique journalier partagé par les calendriers Scolarité et Formation.
// Les deux pages n'ont pas la même notion de ligne (un élève ici, une
// inscription à une formation là) : chacune normalise donc ses encaissements en
// { id, student_id, amount, paid_at, paid_by } avant de les passer ici.
//
// describePayments (facultatif) : (encaissements, jour) → une ligne par élève
// { id, name, code, registrationDate, lines: [{ label, month, amount }], total,
// remaining }. Fourni, il ajoute un bouton « Détails » à chaque ligne
// d'encaisseur.

// Encaissements sans auteur : saisies antérieures à l'enregistrement de paid_by.
// On les regroupe sous une clé dédiée plutôt que de les écarter, sinon le total
// par utilisateur ne retomberait pas sur le total du jour.
const UNASSIGNED_USER = 'unassigned'

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function aggregateDailyRows(payments, schoolYearStart) {
  const start = Number(schoolYearStart) || 0
  if (!start) return []
  const schoolStart = `${start}-09-01`
  const schoolEnd = `${start + 1}-08-31`
  const byDay = new Map()
  for (const payment of payments || []) {
    const dayKey = accountingDayBucket(payment.paid_at || payment.created_at || payment.month)
    if (!dayKey) continue
    if (dayKey < schoolStart || dayKey > schoolEnd) continue
    const current = byDay.get(dayKey) || {
      date: dayKey,
      total: 0,
      studentIds: new Set(),
      payments: [],
      byUser: new Map(),
    }
    current.total += toNumber(payment.amount)
    current.studentIds.add(payment.student_id)
    current.payments.push(payment)

    const userKey = payment.paid_by || UNASSIGNED_USER
    const userRow = current.byUser.get(userKey) || { userId: userKey, total: 0, studentIds: new Set(), payments: [] }
    userRow.total += toNumber(payment.amount)
    userRow.studentIds.add(payment.student_id)
    userRow.payments.push(payment)
    current.byUser.set(userKey, userRow)

    byDay.set(dayKey, current)
  }
  return [...byDay.values()]
    .map((row) => ({
      date: row.date,
      total: row.total,
      count: row.studentIds.size,
      payments: row.payments,
      // Le plus gros encaisseur en tête : c'est l'ordre utile pour lire une journée.
      users: [...row.byUser.values()]
        .map((entry) => ({ userId: entry.userId, total: entry.total, count: entry.studentIds.size, payments: entry.payments }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function exportToExcel(rows, { perUser, userLabel, sheetName, fileName }) {
  const workbook = XLSX.utils.book_new()
  const lines = perUser
    ? rows.flatMap((row) => [
        {
          Date: formatAccountingDay(row.date),
          Utilisateur: 'Total du jour',
          'Montant total encaissé': Number(row.total || 0),
          'Élèves facturés / payés': Number(row.count || 0),
        },
        ...row.users.map((entry) => ({
          Date: formatAccountingDay(row.date),
          Utilisateur: userLabel(entry.userId),
          'Montant total encaissé': Number(entry.total || 0),
          'Élèves facturés / payés': Number(entry.count || 0),
        })),
      ])
    : rows.map((row) => ({
        Date: formatAccountingDay(row.date),
        'Montant total encaissé': Number(row.total || 0),
        'Élèves facturés / payés': Number(row.count || 0),
      }))
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lines), sheetName)
  XLSX.writeFile(workbook, fileName)
}

export default function DailyHistoryPanel({
  payments,
  schoolMonths,
  schoolYearStart,
  branchId,
  isCenterWide,
  currentDayKey,
  sheetName = 'Historique journalier',
  filePrefix = 'historique-journalier',
  describePayments = null,
}) {
  const [mode, setMode] = useState('month')
  const [month, setMonth] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [historyUser, setHistoryUser] = useState('all')
  const [accountingUsers, setAccountingUsers] = useState([])
  // Ligne dont on affiche le détail : { date, userId, payments }.
  const [details, setDetails] = useState(null)

  // Seul un rôle « centre » a besoin des noms : les autres ne voient que leurs
  // propres encaissements, il n'y a personne à nommer dans leur historique.
  useEffect(() => {
    if (!isCenterWide) return undefined
    let active = true
    fetchAccountingUsers()
      .then((rows) => {
        if (active) setAccountingUsers(rows)
      })
      .catch((err) => console.error(err))
    return () => {
      active = false
    }
  }, [isCenterWide])

  const usersById = useMemo(
    () =>
      Object.fromEntries(
        accountingUsers.map((row) => [row.id, `${row.first_name || ''} ${row.last_name || ''}`.trim()])
      ),
    [accountingUsers]
  )

  const userLabelOf = useCallback(
    (userId) => {
      if (!userId || userId === UNASSIGNED_USER) return 'Non attribué'
      return usersById[userId] || 'Utilisateur supprimé'
    },
    [usersById]
  )

  // Le menu ne liste que les personnes qui ont réellement encaissé sur l'année
  // affichée : inutile de proposer un utilisateur dont l'historique est vide.
  const userOptions = useMemo(() => {
    const ids = new Set()
    for (const payment of payments) ids.add(payment.paid_by || UNASSIGNED_USER)
    return [...ids]
      .map((id) => ({ id, label: userLabelOf(id) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [payments, userLabelOf])

  const scopedPayments = useMemo(() => {
    if (!isCenterWide || historyUser === 'all') return payments
    return payments.filter((payment) => (payment.paid_by || UNASSIGNED_USER) === historyUser)
  }, [payments, isCenterWide, historyUser])

  const dailyRows = useMemo(
    () => aggregateDailyRows(scopedPayments, schoolYearStart),
    [scopedPayments, schoolYearStart]
  )

  const filteredRows = useMemo(() => {
    if (mode === 'month' && month) return dailyRows.filter((row) => row.date.startsWith(month))
    if (mode === 'range') {
      return dailyRows.filter((row) => {
        if (from && row.date < from) return false
        if (to && row.date > to) return false
        return true
      })
    }
    return dailyRows
  }, [dailyRows, mode, month, from, to])

  const columnCount = (isCenterWide ? 4 : 3) + (describePayments ? 1 : 0)
  const detailRows = details && describePayments ? describePayments(details.payments, details.date) : []
  const detailTotal = detailRows.reduce((sum, row) => sum + row.total, 0)
  const detailRemaining = detailRows.reduce((sum, row) => sum + (row.remaining || 0), 0)

  const detailsButton = (date, userId, list) => (
    <td className="daily-history-details-cell">
      <button
        type="button"
        className="daily-history-details"
        title="Détails"
        aria-label="Détails"
        onClick={() => setDetails({ date, userId, payments: list })}
      >
        <Eye size={18} />
      </button>
    </td>
  )

  const runExport = () =>
    exportToExcel(filteredRows, {
      perUser: isCenterWide,
      userLabel: userLabelOf,
      sheetName,
      fileName: `${filePrefix}-${schoolYearStart}-${branchId || 'toutes-succursales'}.xlsx`,
    })

  return (
    <section className="daily-history-panel">
      <div className="daily-history-toolbar">
        <div className="daily-history-filters">
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>Par mois</button>
          <button className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}>Par plage</button>
        </div>
        <button className="history-export" onClick={runExport}>Exporter</button>
      </div>

      {isCenterWide && (
        <label className="daily-history-user">
          <span>Utilisateur</span>
          <select value={historyUser} onChange={(e) => setHistoryUser(e.target.value)}>
            <option value="all">Tous les utilisateurs</option>
            {userOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      {mode === 'month' ? (
        <label className="daily-history-month">
          <span>Mois</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">Tous les mois</option>
            {schoolMonths.map((item) => (
              <option key={item.key} value={item.key.slice(0, 7)}>{item.label}</option>
            ))}
          </select>
        </label>
      ) : (
        <div className="daily-history-range">
          <label><span>Du</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>Au</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}

      <div className="daily-history-summary">
        <span>{filteredRows.length} jour{filteredRows.length > 1 ? 's' : ''} affiché{filteredRows.length > 1 ? 's' : ''}</span>
      </div>

      <div className="daily-history-table-wrap">
        <table className="daily-history-table">
          <thead>
            <tr>
              <th>Date</th>
              {isCenterWide && <th>Utilisateur</th>}
              <th>Montant total encaissé</th>
              <th className="daily-history-count">Élèves facturés / payés</th>
              {describePayments && <th className="daily-history-details-cell">Détails</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="daily-history-empty">Aucune donnée pour ce filtre.</td>
              </tr>
            ) : isCenterWide ? (
              // Vue centre : la journée en tête, puis le détail par encaisseur.
              filteredRows.map((row) => (
                <Fragment key={row.date}>
                  <tr className={`daily-history-day${row.date === currentDayKey ? ' current-day' : ''}`}>
                    <td>{formatAccountingDay(row.date)}</td>
                    <td>Total du jour</td>
                    <td>{Number(row.total || 0).toLocaleString('fr-FR')} DH</td>
                    <td className="daily-history-count">{row.count}</td>
                    {describePayments && <td />}
                  </tr>
                  {row.users.map((entry) => (
                    <tr
                      key={`${row.date}:${entry.userId}`}
                      className={`daily-history-user-row${row.date === currentDayKey ? ' current-day' : ''}`}
                    >
                      <td />
                      <td>{userLabelOf(entry.userId)}</td>
                      <td>{Number(entry.total || 0).toLocaleString('fr-FR')} DH</td>
                      <td className="daily-history-count">{entry.count}</td>
                      {describePayments && detailsButton(row.date, entry.userId, entry.payments)}
                    </tr>
                  ))}
                </Fragment>
              ))
            ) : (
              filteredRows.map((row) => (
                <tr key={row.date} className={row.date === currentDayKey ? 'current-day' : ''}>
                  <td>{formatAccountingDay(row.date)}</td>
                  <td>{Number(row.total || 0).toLocaleString('fr-FR')} DH</td>
                  <td className="daily-history-count">{row.count}</td>
                  {describePayments && detailsButton(row.date, null, row.payments)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {details && (
        <div className="fee-overlay" onClick={() => setDetails(null)}>
          <section className="history-details-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetails(null)} aria-label="Fermer">×</button>
            <h2>Détail des encaissements</h2>
            <p>
              {formatAccountingDay(details.date)}
              {isCenterWide && details.userId ? ` — ${userLabelOf(details.userId)}` : ''}
            </p>
            <div className="daily-history-table-wrap">
              <table className="daily-history-table history-details-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Date d'inscription</th>
                    <th>Facturé ce jour</th>
                    <th>Montant total</th>
                    <th>Reste à facturer</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <b>{row.name}</b>
                        {row.code && <small>{row.code}</small>}
                      </td>
                      <td>{formatFrenchDate(row.registrationDate)}</td>
                      <td>
                        <ul className="history-details-lines">
                          {row.lines.map((line, index) => (
                            <li key={index}>
                              <span>{line.label}{line.month && <small> — {line.month}</small>}</span>
                              <span>{line.amount.toLocaleString('fr-FR')} DH</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td><b>{row.total.toLocaleString('fr-FR')} DH</b></td>
                      <td className={row.remaining > 0 ? 'history-details-due' : ''}>
                        {row.remaining == null ? '—' : `${row.remaining.toLocaleString('fr-FR')} DH`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{detailRows.length} élève{detailRows.length > 1 ? 's' : ''}</td>
                    <td>{detailTotal.toLocaleString('fr-FR')} DH</td>
                    <td>{detailRemaining.toLocaleString('fr-FR')} DH</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
