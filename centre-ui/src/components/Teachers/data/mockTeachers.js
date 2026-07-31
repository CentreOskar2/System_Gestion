export const subjects = ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Arabe', 'Anglais', 'Philosophie']

export const branches = ['Succursale Nord', 'Succursale Sud', 'Succursale Centre']

export const initialTeachers = [
  { id: 1, firstName: 'Karim', lastName: 'El Amrani', phone: '0612345678', cin: 'AB123456', address: 'Casablanca', hiredAt: '2024-09-01', subjects: ['Mathématiques'], branches: ['Succursale Nord', 'Succursale Centre'], paymentType: 'fixe', salary: '7000', rates: {}, active: true },
  { id: 2, firstName: 'Salma', lastName: 'Bennani', phone: '0623456789', cin: 'CD234567', address: 'Casablanca', hiredAt: '2024-09-01', subjects: ['Physique-Chimie', 'SVT'], branches: ['Succursale Nord'], paymentType: 'pourcentage', salary: '', rates: { 'Physique-Chimie': '40', SVT: '35' }, active: true },
  { id: 3, firstName: 'Youssef', lastName: 'Tazi', phone: '0634567890', cin: 'EF345678', address: 'Rabat', hiredAt: '2024-10-01', subjects: ['Français', 'Philosophie'], branches: ['Succursale Sud'], paymentType: 'fixe', salary: '6500', rates: {}, active: true },
  { id: 4, firstName: 'Nadia', lastName: 'Idrissi', phone: '0645678901', cin: 'GH456789', address: 'Marrakech', hiredAt: '2024-10-01', subjects: ['Anglais'], branches: ['Succursale Centre', 'Succursale Sud'], paymentType: 'pourcentage', salary: '', rates: { Anglais: '40' }, active: true },
  { id: 5, firstName: 'Omar', lastName: 'Fassi', phone: '0656789012', cin: 'IJ567890', address: 'Casablanca', hiredAt: '2024-11-01', subjects: ['Arabe'], branches: ['Succursale Nord'], paymentType: 'fixe', salary: '6000', rates: {}, active: false },
]

export const emptyTeacher = { firstName: '', lastName: '', phone: '', cin: '', address: '', hiredAt: '', subjects: [], branches: [], paymentType: 'fixe', salary: '', rates: {}, active: true }
