# application

Use case dell'app e interfacce (porte) verso ciò che sta fuori: backend, foto, browser.

## Porte (`ports.ts`)
| Porta | Operazioni |
|---|---|
| `PlayerAccounts` | `checkSecretWord`, `join` (parola + identità; l'admin entra senza parola), `resume` |
| `GameBoard` (letture con token) | `catalog`, `completionsOf`, `participants`, `feed(sessione, sezione, before)` (una sezione alla volta, `posts` o `deeds`, ADR 0021), `profile`, `likers`, `features` (funzioni accese, ADR 0014), `permissions` (cosa può creare questa sessione, ADR 0018), `onChange(tabella)` |
| `PhotoLinkProvider` | `links`: link firmati per id di foto |
| `PlayerMoves` | `complete`, `completeWithPhoto`, `undo`, `deleteOwnPhoto`, `toggleLike`, `createPost`, `deletePost`, `updateBio`, `setAvatar` |
| `EveningAdmin` | azioni (`add`/`update`/`remove`), `album`, `deletePhoto`, `secretWord`, `setSecretWord`, `accessLog`, `setFeature`, `players` (tutti i giocatori come `ManagedPlayer`), `setBlocked` (blocca o sblocca: chi è bloccato esce subito), `setPermission`, `resetEvening` |
| `Chat` (ADR 0015, 0016) | letture: `conversations`, `conversation`, `messages`, `mediaLinks` (`ChatMediaLinks`: link del file e, per le foto, della miniatura); scritture: `open`, `sendText` / `sendPhoto` / `sendVoice` (con `replyTo`: l'id del messaggio a cui si risponde, o `null`), `editMessage`, `deleteMessage(scope)` (`me` \| `everyone`), `forward` (a più conversazioni), `markRead`, `markUnread`, `clear(mode)` (`empty` svuota, `remove` toglie la chat dall'elenco; solo per chi lo chiede); `typing` (segnale "sta scrivendo", senza risposta); `onInbox(listener)`: una conversazione del giocatore è cambiata (messaggio nuovo, modificato o eliminato); `onTyping(listener)`: l'altra persona sta scrivendo in quella conversazione |
| `Polls` (ADR 0019) | `list` (con la sessione di giocatore o admin; conteggi e votanti arrivano `null` finché le regole del sondaggio li nascondono), `create` (restituisce l'id), `vote` (solo `PlayerSession`: l'admin non vota; le opzioni scelte sostituiscono il voto precedente), `close`, `remove` (autore o admin) |
| `Challenges` (ADR 0020) | `list` (con la sessione di giocatore o admin), `completers` (tutti quelli che l'hanno fatta, non solo i primi N, ADR 0021), `create` (restituisce l'id), `update` (`ChallengeEdit`: `extendMinutes` fa ripartire il tempo da adesso), `end` (termina subito), `remove` (autore o admin); `complete` e `undo` solo con `PlayerSession`: l'admin crea e gestisce ma non partecipa |
| `VoiceRecorder` | `start` (chiede il microfono la prima volta; `RecordingFailure`: `denied` \| `unsupported`), `stop` (restituisce la registrazione, anche se si è fermata da sola al limite), `cancel` |
| `PhotoProcessor` | `prepare(file, 'original' \| 'square')` |
| `PhotoExporter` | `canShare`, `share`, `shareText`, `download`, `downloadZip` |
| `Clipboard`, `SessionStore`, `Haptics` | appunti (parola della serata, "Copia testo" della chat), token, vibrazione |

Le letture con un token non più valido rifiutano con `SessionExpiredError`, così le
schermate riportano all'ingresso. Le scritture restituiscono un `Result`: `WriteFailure`
(`unauthorized` | `rejected` | `unavailable`), oppure `FeatureFailure` (= `WriteFailure` |
`disabled`) per ciò che un interruttore dell'admin può bloccare (post e chat). Chi salva una
foto (`completeWithPhoto`, `createPost`, `Chat.sendPhoto`, `Chat.forward`) può ricevere anche
`PhotoLimitFailure` (`photo-limit`: il giocatore ha già `PHOTO_LIMIT` foto, ADR 0018); è un
tipo a parte, sommato solo a queste firme, così le operazioni senza foto non devono gestirlo.
`JoinFailure` ha anche `blocked` (l'admin ha tolto quel giocatore dalla serata).
`PollFailure` (= `FeatureFailure` | `forbidden` | `closed` | `locked`) è di `create` e `vote`:
`forbidden` il giocatore non ha il permesso di creare, `closed` troppo tardi per votare,
`locked` ha già votato e il cambio non è ammesso. `close` e `remove` restano su `WriteFailure`.
`ChallengeFailure` (= `FeatureFailure` | `forbidden` | `ended` | `full`) è di `create` e
`complete`: `ended` il tempo è scaduto, `full` i primi N l'hanno già fatta. `update`, `end`,
`remove` e `undo` restano su `WriteFailure`.

`ChangedTable` (da `CHANGED_TABLES`) elenca le tabelle annunciate da `onChange`, compresa
`evening_settings` (parola e interruttori), `polls` e `challenges`. Le pagine hanno una dimensione fissa, `FEED_PAGE_SIZE` = 20 e
`CHAT_PAGE_SIZE` = 40: una pagina più corta vuol dire che l'elenco è completo, così non serve
una richiesta in più per scoprire che non c'è altro.

## Use case
- `join-game.ts`: valida l'identità, entra (con la risposta a "sei tu?"), salva il token.
- `resume-session.ts`: "rientrato", "da iscrivere" oppure "offline" (il token si conserva).
- `complete-action.ts`: foto obbligatoria senza foto → rifiuto immediato; prepara la foto.
  `CompleteError` comprende `PhotoLimitFailure`.
- `save-action.ts`: crea o modifica un'azione (admin).
- `social.ts`: `publishPost` (didascalia ≤ 300; `PublishError` comprende `PhotoLimitFailure`),
  `changeAvatar` (ritaglio quadrato, fuori dal limite di foto), `saveBio` (≤ 500).

La chat non ha use case qui: le sue regole (testo valido, unione dei messaggi, voci del menu,
chi può eliminare per tutti) sono funzioni pure di `domain/chat.ts`, usate direttamente dallo
stato in `features/chat/`. Lo stesso vale per i sondaggi (`domain/poll.ts`, stato in
`features/polls/`) e per le sfide (`domain/challenge.ts`, stato in `features/challenges/`).

## Relazioni
- Dipende da: `domain/`.
- Usato da: `features/`, `app/`.
- Implementato da: `infrastructure/`.
- Dati posseduti: nessuno.
