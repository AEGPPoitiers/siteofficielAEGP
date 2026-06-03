import { useIsBdeMember } from '../lib/useIsBdeMember'
import { BoiteaideeAdmin } from './BoiteaideeAdmin'
import { BoiteaideeSubmit } from './BoiteaideeSubmit'

export default function Boiteaidee() {
  const { loading, isBde } = useIsBdeMember()
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  return isBde ? <BoiteaideeAdmin /> : <BoiteaideeSubmit />
}
