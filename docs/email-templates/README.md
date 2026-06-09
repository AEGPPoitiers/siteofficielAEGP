# Templates email (Supabase Auth)

Copies versionnées des templates email personnalisés du site AEGP. La config Supabase
n'étant pas dans le dépôt, on garde ici une référence pour ne pas les perdre et pouvoir
les rééditer facilement.

## Fichiers

| Fichier | Template Supabase | Subject |
|---|---|---|
| `invite.html` | Invite user | `Active ton compte AEGP` |
| `reset-password.html` | Reset Password | `Réinitialise ton mot de passe AEGP` |

## Où les appliquer

Dashboard Supabase → **Authentication → Emails → Templates** → sélectionner le template
correspondant → coller le **Subject** et le **Message body (HTML)** → **Save**.

## Notes

- Variable utilisée : `{{ .ConfirmationURL }}` (lien d'action, atterrit sur `/set-password`).
- Logo = wordmark texte « AEGP » (pas d'image, zéro risque de lien cassé). Pour mettre
  le logo image, remplacer le `<span>AEGP</span>` du bandeau par `<img src="…" alt="AEGP" height="28">`
  (nécessite une URL publique stable).
- Ton : tutoiement (contexte BDE).
- Design sobre (peu d'images, bon ratio texte/HTML) pour limiter le classement en spam —
  d'autant que l'envoi passe par Brevo avec un expéditeur `@gmail.com` (cf. note délivrabilité
  DMARC + redirecteur de tracking Brevo `sendibt3.com`).
- Après toute modification ici, **reporter le changement dans Supabase** (ces fichiers ne sont
  qu'une archive, ils ne sont pas déployés automatiquement).
