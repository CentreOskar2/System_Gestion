export const students = [
  { id: 1, name: 'Yasmine Alaoui', code: 'REG-2026-1000', cycle: 'Préscolaire', level: 'Petite section', branch: 'Succursale Nord', subjects: 0, payment: 'Impayé', active: true, phone: '0613100411' },
  { id: 2, name: 'Adam Drissi', code: 'REG-2026-1001', cycle: 'Primaire', level: '2ème année', branch: 'Succursale Sud', subjects: 0, payment: 'N/A', active: true, phone: '0623100412' },
  { id: 3, name: 'Lina Ghazi', code: 'REG-2026-1002', cycle: 'Collège', level: '9ème (3AC)', branch: 'Succursale Centre', subjects: 4, payment: 'N/A', active: true, phone: '0633100413', chosen: ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français'] },
  { id: 4, name: 'Zakaria Jaidi', code: 'REG-2026-1003', cycle: 'Lycée', level: 'Tronc commun', branch: 'Succursale Nord', subjects: 5, payment: 'N/A', active: true, phone: '0723200273', chosen: ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais'] },
  { id: 5, name: 'Ines Mansouri', code: 'REG-2026-1004', cycle: 'Formation', level: 'Formation Pro', branch: 'Succursale Sud', subjects: 0, payment: 'N/A', active: false, phone: '0643100414', chosen: ['Anglais'] },
  { id: 6, name: 'Mehdi Peretti', code: 'REG-2026-1005', cycle: 'Préscolaire', level: 'Grande section', branch: 'Succursale Centre', subjects: 0, payment: 'Payé', active: true, phone: '0653100415' },
]

export const attendanceItems = [
  { id: 'absence', text: 'Absence' },
  { id: 'cahier', text: 'Cahier non apporté' },
  { id: 'exercice', text: 'Exercice non fait / manquant' },
  { id: 'betise', text: 'Bêtise', detail: 'Détail (optionnel)...' },
  { id: 'retard', text: 'Retard', detail: 'Nombre de minutes' }
]

export const subjects = ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais']

export const levelsByCycle = {
  'Préscolaire': ['Petite section', 'Moyenne section', 'Grande section'],
  Primaire: ['1ère année', '2ème année', '3ème année', '4ème année', '5ème année', '6ème année'],
  Collège: ['7ème (1AC)', '8ème (2AC)', '9ème (3AC)'],
  Formation: ['Formation Pro', 'Informatique', 'Langues'],
  Lycée: ['Tronc commun', '1ère Bac', '2ème Bac']
}

export const branchesByLevel = {
  'Tronc commun': ['Sciences', 'Lettres', 'Technique'],
  '1ère Bac': ['Sciences Mathématiques', 'Sciences Physiques', 'Sciences SVT', 'Sciences Économiques'],
  '2ème Bac': ['Sciences Mathématiques', 'Sciences Physiques', 'Sciences SVT', 'Sciences Économiques']
}
