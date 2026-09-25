# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`: `Action` (titolo, descrizione, tipo, punti con segno, `photoPolicy`,
  `difficulty`), `ActionDraft` + `validateActionDraft` (titolo 2-40, descrizione 3-300, punti
  interi 0-1000 senza segno: il segno lo decide il tipo, ADR 0010), `isSharedByEveryone`,
  `acceptsPhoto`, `pointsMagnitude`.
- `chat.ts` (ADR 0015, 0016):
  - costanti: `MESSAGE_MAX` (1000 caratteri), `VOICE_MAX_MS` (60 s), `FORWARD_MAX` (inoltro a
    5 chat al massimo), `TYPING_SIGNAL_EVERY_MS` (2,5 s tra due segnali "sta scrivendo") e
    `TYPING_SHOWN_MS` (5 s di "sta scrivendo" dopo l'ultimo segnale);
  - tipi: `ChatPeer`, `LastMessage` (tipo, testo, mio o no, ora; `deleted` se eliminato per
    tutti), `ConversationSummary` (l'altra persona, `last` = `null` dopo "Svuota messaggi",
    non letti, `marked` = "da leggere"), `QuotedMessage` (ciò che una risposta mostra del
    messaggio citato), `ChatMessage` = testo (con `edited`) | foto | vocale (con durata) |
    `deleted` (eliminato per tutti: resta solo la traccia), tutti con `forwarded` e `replyTo`;
    `MessageAction` (`reply` | `copy` | `edit` | `forward` | `delete`), `DeleteScope` (`me` |
    `everyone`), `VoiceRecording` (file, tipo MIME senza codec, durata);
  - regole: `messageText` (testo ripulito, o `null` se vuoto o troppo lungo), `unreadOf` (una
    chat segnata "da leggere" vale almeno un non letto), `unreadTotal`, `mergeMessages` (dal più
    vecchio, la copia più fresca vince), `previewOf` (anteprima nell'elenco: "Tu: …",
    "📷 Foto", "🎤 Messaggio vocale", "Messaggio eliminato"), `quoteOf` / `quoteText` (la
    citazione di un messaggio e il suo testo), `actionsFor` (le voci del menu di un messaggio,
    in ordine: copia solo i testi, modifica solo i propri testi, un messaggio eliminato offre
    solo "Elimina"), `deleteScopesFor` ("per tutti" solo a chi l'ha inviato, e una volta sola).
- `completion.ts`: `Completion` (id per i like, azione, ora, foto, chi l'ha segnata),
  `isDone`, `isOwnedBy`, `effectOfDeletingPhoto` (togliere una foto obbligatoria annulla
  l'azione).
- `evening.ts`: `JoinRequest` (parola segreta + identità + `RealNameResolution`: `ask`,
  `takeover` del profilo esistente o `distinct`), `AccessLogEntry`.
- `features.ts` (ADR 0014): `FeatureName` (`actions` | `chat` | `feed` | `leaderboard`), `Features`,
  `ALL_FEATURES_ON` (il valore prima della prima lettura).
- `feed.ts`: `FeedItem` = `PostItem` | `CompletionItem`, `LikeSummary`, `Liker`, `mergeFeed`
  (più recenti prima, la copia più fresca vince), `withLike`, `isValidCaption` (300 caratteri).
- `profile.ts`: `Profile` con completamenti e post, `photosOf` (tutte le foto di un giocatore),
  `isValidBio` (500 caratteri).
- `player.ts`: `Player`, `Participant` (con foto profilo, azioni, punti), `Session` =
  `PlayerSession` (con `inboxKey`, la chiave segreta del canale della chat) | `AdminSession`,
  `IDENTITY_LIMITS` (nickname 2–20, nome vero 2–40), `validateIdentity`, `sameName`, `rankParticipants` (punti, poi azioni, poi nickname).
- `text.ts`: `normalizeText`. `result.ts`: `Result<T, E>` con `ok` / `err`.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

Le stesse regole sono applicate anche dal database (`supabase/migrations`), che resta
l'autorità finale: il dominio serve a rispondere subito e a spiegarle nell'interfaccia.
