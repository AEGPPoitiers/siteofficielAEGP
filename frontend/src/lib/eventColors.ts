/** Palette de couleurs d'événement proposée à la création (valeurs hex stockées
 *  dans `events.color`). null/absente = couleur par défaut du calendrier. */
export type EventColor = { value: string; label: string }

export const EVENT_COLORS: EventColor[] = [
  { value: '#2563eb', label: 'Bleu' },
  { value: '#16a34a', label: 'Vert' },
  { value: '#d97706', label: 'Orange' },
  { value: '#dc2626', label: 'Rouge' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#0d9488', label: 'Sarcelle' },
  { value: '#db2777', label: 'Rose' },
  { value: '#475569', label: 'Ardoise' },
]
