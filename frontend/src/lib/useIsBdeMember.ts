import { useAuth } from '../contexts/AuthContext'

// MOCK temporaire : tant que la table `profiles` n'est pas livrée par l'équipe back,
// on considère tout utilisateur connecté comme membre BDE si VITE_BDE_MOCK=true.
// À remplacer par une lecture de profiles.is_bde_member dès que la table existe.
export function useIsBdeMember(): boolean {
  const { user } = useAuth()
  if (!user) return false
  return import.meta.env.VITE_BDE_MOCK === 'true'
}
