# application

Use case dell'app e interfacce (porte) verso ciò che sta fuori: backend, foto, browser.

## Porte (`ports.ts`)
| Porta | Operazioni |
|---|---|
| `PlayerAccounts` | `checkSecretWord`, `join` (parola + identità; l'admin entra senza parola), `resume` |
| `GameBoard` (letture con token) | `catalog`, `completionsOf`, `participants`, `feed`, `profile`, `likers`, `onChange(tabella)` |
| `PhotoLinkProvider` | `links`: link firmati per id di foto |
| `PlayerMoves` | `complete`, `completeWithPhoto`, `undo`, `deleteOwnPhoto`, `toggleLike`, `createPost`, `deletePost`, `updateBio`, `setAvatar` |
| `EveningAdmin` | azioni (`add`/`update`/`remove`), `album`, `deletePhoto`, `secretWord`, `setSecretWord`, `accessLog`, `resetEvening` |
| `PhotoProcessor` | `prepare(file, 'original' \| 'square')` |
| `PhotoExporter` | `canShare`, `share`, `shareText`, `download`, `downloadZip` |
| `Clipboard`, `SessionStore`, `Haptics` | appunti, token, vibrazione |

Le letture con un token non più valido rifiutano con `SessionExpiredError`, così le
schermate riportano all'ingresso. Le scritture restituiscono un `Result`.

## Use case
- `join-game.ts`: valida l'identità, entra (con la risposta a "sei tu?"), salva il token.
- `resume-session.ts`: "rientrato", "da iscrivere" oppure "offline" (il token si conserva).
- `complete-action.ts`: foto obbligatoria senza foto → rifiuto immediato; prepara la foto.
- `save-action.ts`: crea o modifica un'azione (admin).
- `social.ts`: `publishPost` (didascalia ≤ 300), `changeAvatar` (ritaglio quadrato),
  `saveBio` (≤ 500).

## Relazioni
- Dipende da: `domain/`.
- Usato da: `features/`, `app/`.
- Implementato da: `infrastructure/`.
- Dati posseduti: nessuno.
