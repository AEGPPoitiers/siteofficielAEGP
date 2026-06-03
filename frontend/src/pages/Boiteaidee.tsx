import { useIsBdeMember } from '../lib/useIsBdeMember'
import { BoiteaideeAdmin } from './BoiteaideeAdmin'
import { BoiteaideeSubmit } from './BoiteaideeSubmit'

export default function Boiteaidee() {
  const isBde = useIsBdeMember()
  return isBde ? <BoiteaideeAdmin /> : <BoiteaideeSubmit />
}
