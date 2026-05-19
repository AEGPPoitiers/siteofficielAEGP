export default function Tutorat() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Tutorat</h1>
      <p className="text-gray-600">
        Hiérarchie : <br />
        Année scolaire -{'>'} Promo (L3,M1,M2) -{'>'} Option
        (Physio,Biotech,Imagerie) -{'>'} Cours (Matiere) -{'>'} Type de doc
        (CM,TD,TP) <br />
        Connexion requise <br />
        Fonction de recherche par mot clé dans le nom de du document + filtres +
        date de publication
      </p>
    </div>
  )
}
