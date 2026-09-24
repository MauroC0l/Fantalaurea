# application

Use case dell'app e interfacce (porte) verso ciò che sta fuori: backend, foto, memoria del
browser, vibrazione.

## Porte (`ports.ts`)
| Porta | Operazioni |
|---|---|
| `PlayerAccounts` | `join` (iscrizione, rientro o accesso admin), `resume` |
| `GameBoard` (letture) | `catalog`, `completionsOf`, `participants`, `onChange` (tempo reale) |
| `PlayerMoves` (scritture del giocatore) | `complete`, `completeWithPhoto`, `undo`, `deleteOwnPhoto`, `ownPhotos` |
| `EveningAdmin` | `addAction`, `updateAction`, `removeAction`, `album`, `deletePhoto`, `resetEvening` |
| `PhotoProcessor` | `prepare`: ricodifica la foto scelta (JPEG, orientamento, dimensione) |
| `PhotoExporter` | `canShare`, `share`, `download`, `downloadZip` |
| `SessionStore` | dove si conserva il token |
| `Haptics` | vibrazione (`tap`, `success`, `warning`) |

Le letture rifiutano la Promise se il backend non risponde; le scritture restituiscono un
`Result` con il motivo del fallimento.

## Use case
- `join-game.ts`: valida l'identità, entra, salva il token.
- `resume-session.ts`: "rientrato", "da iscrivere" oppure "offline" (il token si conserva).
- `complete-action.ts`: rifiuta subito un'azione con foto obbligatoria senza foto, prepara
  la foto, sceglie tra completamento semplice e con foto.
- `save-action.ts`: valida la bozza e crea o modifica un'azione (admin).

## Relazioni
- Dipende da: `domain/`.
- Usato da: `features/` (use case e porte), `app/` (composizione).
- Implementato da: `infrastructure/`.
- Dati posseduti: nessuno.
