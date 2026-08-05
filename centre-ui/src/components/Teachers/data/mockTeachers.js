// Cycles
export const cycles = ['Préscolaire', 'Primaire', 'Collège', 'Lycée', 'Formation']

// Levels by cycle
export const levelsByCycle = {
  'Préscolaire': ['Petite section', 'Moyenne section', 'Grande section'],
  'Primaire': ['1ère année (Primaire)', '2ème année (Primaire)', '3ème année (Primaire)', '4ème année (Primaire)', '5ème année (Primaire)', '6ème année (Primaire)'],
  'Collège': ['7ème (1AC) (Collège)', '8ème (2AC) (Collège)', '9ème (3AC) (Collège)'],
  'Lycée': ['Tronc commun (Lycée)', '1ère Bac (Lycée)', '2ème Bac (Lycée)'],
  'Formation': ['Formation professionnelle', 'Formation continue']
}

// Subjects
export const subjects = ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Arabe', 'Anglais', 'Philosophie']

// Branches
export const branches = ['Succursale Nord', 'Succursale Sud', 'Succursale Centre']

// Mock groups data - combination of cycle + level + branch + subject
export const mockGroups = [
  { id: 'g1', cycle: 'Lycée', level: '2ème Bac (Lycée)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 2Bac SM · G1', studentsCount: 8 },
  { id: 'g2', cycle: 'Lycée', level: '2ème Bac (Lycée)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 2Bac SM · G2', studentsCount: 12 },
  { id: 'g3', cycle: 'Lycée', level: '1ère Bac (Lycée)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 1Bac SM · G1', studentsCount: 10 },
  { id: 'g4', cycle: 'Collège', level: '7ème (1AC) (Collège)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 7ème 1AC · G1', studentsCount: 25 },
  { id: 'g5', cycle: 'Collège', level: '7ème (1AC) (Collège)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 7ème 1AC · G2', studentsCount: 22 },
  { id: 'g6', cycle: 'Collège', level: '8ème (2AC) (Collège)', branch: 'Succursale Nord', subject: 'Mathématiques', name: 'Maths — 8ème 2AC · G1', studentsCount: 20 },
  { id: 'g7', cycle: 'Collège', level: '9ème (3AC) (Collège)', branch: 'Succursale Sud', subject: 'Mathématiques', name: 'Maths — 9ème 3AC · G1', studentsCount: 18 },
  { id: 'g8', cycle: 'Primaire', level: '6ème année (Primaire)', branch: 'Succursale Centre', subject: 'Mathématiques', name: 'Maths — 6ème année · G1', studentsCount: 30 },
  { id: 'g9', cycle: 'Lycée', level: '2ème Bac (Lycée)', branch: 'Succursale Sud', subject: 'Physique-Chimie', name: 'Physique-Chimie — 2Bac SM · G1', studentsCount: 8 },
  { id: 'g10', cycle: 'Collège', level: '7ème (1AC) (Collège)', branch: 'Succursale Centre', subject: 'Français', name: 'Français — 7ème 1AC · G1', studentsCount: 24 },
  { id: 'g11', cycle: 'Lycée', level: '1ère Bac (Lycée)', branch: 'Succursale Centre', subject: 'SVT', name: 'SVT — 1Bac SM · G1', studentsCount: 15 },
  { id: 'g12', cycle: 'Primaire', level: '5ème année (Primaire)', branch: 'Succursale Nord', subject: 'Arabe', name: 'Arabe — 5ème année · G1', studentsCount: 28 },
]

// Helper to get groups matching a teacher's selection
export function getMatchingGroups(cycles, levels, branches, subjects) {
  if (!cycles?.length || !levels?.length || !branches?.length || !subjects?.length) {
    return []
  }
  
  return mockGroups.filter(group => 
    cycles.includes(group.cycle) &&
    levels.includes(group.level) &&
    branches.includes(group.branch) &&
    subjects.includes(group.subject)
  )
}

// Initial teachers data with new structure
export const initialTeachers = [
  { id: 1, firstName: 'Karim', lastName: 'El Amrani', phone: '0612345678', cin: 'AB123456', address: 'Casablanca', hiredAt: '2024-09-01', cycles: ['Lycée'], levels: ['2ème Bac (Lycée)'], subjects: ['Mathématiques'], branches: ['Succursale Nord', 'Succursale Centre'], paymentType: 'fixe', salary: '7000', rates: {}, active: true },
  { id: 2, firstName: 'Salma', lastName: 'Bennani', phone: '0623456789', cin: 'CD234567', address: 'Casablanca', hiredAt: '2024-09-01', cycles: ['Lycée', 'Collège'], levels: ['2ème Bac (Lycée)', '7ème (1AC) (Collège)'], subjects: ['Physique-Chimie', 'SVT'], branches: ['Succursale Nord'], paymentType: 'pourcentage', rates: { 'Lycée': '40', 'Collège': '35' }, active: true },
  { id: 3, firstName: 'Youssef', lastName: 'Tazi', phone: '0634567890', cin: 'EF345678', address: 'Rabat', hiredAt: '2024-10-01', cycles: ['Lycée'], levels: ['1ère Bac (Lycée)'], subjects: ['Français', 'Philosophie'], branches: ['Succursale Sud'], paymentType: 'fixe', salary: '6500', rates: {}, active: true },
  { id: 4, firstName: 'Nadia', lastName: 'Idrissi', phone: '0645678901', cin: 'GH456789', address: 'Marrakech', hiredAt: '2024-10-01', cycles: ['Primaire'], levels: ['6ème année (Primaire)'], subjects: ['Anglais'], branches: ['Succursale Centre', 'Succursale Sud'], paymentType: 'pourcentage', rates: { 'Primaire': '40' }, active: true },
  { id: 5, firstName: 'Omar', lastName: 'Fassi', phone: '0656789012', cin: 'IJ567890', address: 'Casablanca', hiredAt: '2024-11-01', cycles: ['Primaire'], levels: ['4ème année (Primaire)'], subjects: ['Arabe'], branches: ['Succursale Nord'], paymentType: 'fixe', salary: '6000', rates: {}, active: false },
]

// Empty teacher template for new form
export const emptyTeacher = { 
  firstName: '', 
  lastName: '', 
  phone: '', 
  cin: '', 
  address: '', 
  hiredAt: '', 
  cycles: [], 
  levels: [], 
  subjects: [], 
  branches: [], 
  paymentType: 'fixe', 
  salary: '', 
  rates: {}, 
  active: true,
  groups: []
}