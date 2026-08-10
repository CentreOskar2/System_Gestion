export const students = [
  { id: 1, name: 'Yasmine Alaoui', code: 'REG-2026-1000', level: 'Petite section' },
  { id: 2, name: 'Adam Drissi', code: 'REG-2026-1001', level: '2ème année' },
  { id: 3, name: 'Lina Ghazi', code: 'REG-2026-1002', level: '9ème (3AC)' },
  { id: 4, name: 'Zakaria Jaidi', code: 'REG-2026-1003', level: 'Tronc commun' },
  { id: 5, name: 'Sara Saidi', code: 'REG-2026-1006', level: '1ère année' },
  { id: 6, name: 'Ilyas Hakim', code: 'REG-2026-1009', level: 'Formation Pro' },
]

export const subjects = ['Mathématiques', 'Physique-Chimie', 'Français', 'Anglais', 'Arabe']

export const levels = ['6ème année', '9ème (3AC)', 'Tronc commun', '1ère Bac', '2ème Bac']

export const teachers = ['Karim El Amrani', 'Salma Bennani', 'Youssef Tazi', 'Nadia Idrissi', 'Omar Fassi']

export const branches = ['Succursale Nord', 'Succursale Sud', 'Succursale Centre']

export const initialGroups = [
  { id: 1, name: 'Maths — 2Bac SM · G1', schedule: 'Lun/Mer 16:00-18:00 · Salle A1', subject: 'Mathématiques', level: '2ème Bac', teacher: 'Karim El Amrani', branch: 'Succursale Nord', studentIds: [1, 2, 3, 4, 5, 6, 1, 2], active: true },
  { id: 2, name: 'Physique — 1Bac PC · G2', schedule: 'Mar/Jeu 17:00-19:00 · Salle B2', subject: 'Physique-Chimie', level: '1ère Bac', teacher: 'Salma Bennani', branch: 'Succursale Nord', studentIds: [1, 2, 3, 4, 5, 6, 1], active: true },
  { id: 3, name: 'Français — 3AC · G1', schedule: 'Sam 09:00-12:00 · Salle C1', subject: 'Français', level: '9ème (3AC)', teacher: 'Youssef Tazi', branch: 'Succursale Sud', studentIds: [1, 2, 3, 4, 5, 6], active: true },
  { id: 4, name: 'Anglais — Tronc Commun · G1', schedule: 'Ven 15:00-17:00 · Salle D1', subject: 'Anglais', level: 'Tronc commun', teacher: 'Nadia Idrissi', branch: 'Succursale Centre', studentIds: [1, 2, 3, 4, 5, 6, 1, 2], active: true },
  { id: 5, name: 'Arabe — 6ème · G1', schedule: 'Mer 14:00-16:00 · Salle A2', subject: 'Arabe', level: '6ème année', teacher: 'Omar Fassi', branch: 'Succursale Nord', studentIds: [1, 2, 3, 4, 5, 6, 1], active: false },
]

export const blankGroup = { name: '', subject: '', level: '', teacher: '', branch: '', studentIds: [], active: true }
