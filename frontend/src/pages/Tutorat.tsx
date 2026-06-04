import { useIsBdeMember } from '../lib/useIsBdeMember'
import TutoratBrowse from './TutoratBrowse'
import TutoratAdmin from './TutoratAdmin'

export default function Tutorat() {
  const { loading, isBde } = useIsBdeMember()
  if (loading) {
    return <div className="text-center py-12 text-gray-500">Chargement…</div>
  }
  return isBde ? <TutoratAdmin /> : <TutoratBrowse />
}
