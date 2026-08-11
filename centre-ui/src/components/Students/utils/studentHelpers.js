// Calculates the price for a subject based on its name.
export const price = (subject) => {
  if (['Mathématiques', 'Physique-Chimie'].includes(subject)) {
    return 450
  }
  if (subject === 'Philosophie') {
    return 350
  }
  return 400
}

// Generates initials from a full name.
export const initials = (name) => {
  if (!name) return ''
  return name.split(' ').map((word) => word[0]).join('')
}

// Local date as YYYY-MM-DD (avoids the UTC offset bug of toISOString()).
export const today = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
