# domain

Tipi e regole del gioco, in funzioni pure: niente rete, niente browser, niente Svelte.

## API pubblica
- `action.ts`: `Action` (titolo, descrizione, tipo, punti con segno, `photoPolicy`,
  `difficulty`), `ActionDraft` + `validateActionDraft` (titolo 2-40, descrizione 3-300, punti
  interi 0-1000 senza segno: il segno lo decide il tipo, ADR 0010), `isSharedByEveryone`,
  `acceptsPhoto`, `pointsMagnitude`.
- `challenge.ts` (ADR 0020):
  - costanti: `CHALLENGE_TITLE_MAX` (40), `CHALLENGE_DESCRIPTION_MAX` (300),
    `CHALLENGE_POINTS_MAX` (100), `CHALLENGE_DURATIONS` (5, 10, 15, 30, 60 minuti: durate fisse,
    come per i sondaggi), `CHALLENGE_WINNERS` (tutti, 1, 3, 5, 10; `null` = tutti quelli che la
    completano in tempo);
  - tipi: `Challenge` (autore `null` = l'admin, `completions`, `mine` = quando e in che
    posizione l'ho fatta, `winners` in ordine di arrivo), `ChallengeWinner`, `ChallengeDraft`
    (con la durata), `ChallengeEdit` (senza durata: `extendMinutes` `null` lascia la scadenza,
    un numero la fa ripartire da adesso), `ChallengeDraftError`;
  - regole: `validateChallenge` (vale per bozza e modifica: restituisce titolo e descrizione
    ripuliti, o tutti gli errori insieme: titolo 2–40, descrizione fino a 300, punti interi
    1–100), `isRunning`, `secondsLeft`, `spotsLeft` (`null` senza limite), `canComplete` (in
    corso, non ancora fatta, posti rimasti), `earnedPoints` (chi è arrivato oltre un limite
    abbassato dopo non prende i punti), `openFor` (quante se ne possono ancora fare: il numero
    sulla scheda Azioni).
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
- `features.ts` (ADR 0014): `FeatureName` (`actions` | `chat` | `feed` | `leaderboard` | `polls` | `challenges`), `Features`,
  `ALL_FEATURES_ON` (il valore prima della prima lettura).
- `feed.ts`: `FeedItem` = `PostItem` | `CompletionItem`, `LikeSummary`, `Liker`, `mergeFeed`
  (più recenti prima, la copia più fresca vince), `withLike`, `isValidCaption` (300 caratteri).
- `poll.ts` (ADR 0019):
  - costanti: `POLL_QUESTION_MAX` (200), `POLL_OPTION_MAX` (100), `POLL_OPTIONS_MIN` /
    `POLL_OPTIONS_MAX` (2–10), `POLL_DURATIONS` (le durate offerte: nessuna, 5, 15, 30 minuti, 1 e
    2 ore; durate fisse e non data e ora, a una festa serve "tra 15 minuti");
  - tipi: `ResultsVisibility` (`always` | `after-vote` | `after-close`), `PollRules` (anonimo,
    più scelte, risultati, cambio voto, chiusura quando hanno votato tutti), `PollDraft` +
    `PollDraftError`, `PollOption` (`votes` e `voters` sono `null` finché il server li nasconde:
    il dominio non può inventarli), `PollVoter`, `Poll` (autore `null` = l'admin, `closed` com'era
    alla lettura, `myVotes`, `canManage`, `resultsVisible`);
  - `DEFAULT_POLL_RULES` (anonimo, una scelta, risultati dopo il voto, voto modificabile);
  - regole: `validatePollDraft` (restituisce la bozza ripulita, senza opzioni vuote, o tutti gli
    errori insieme: domanda 3–200, 2–10 opzioni, nessuna oltre 100 caratteri, nessun doppione
    senza distinguere maiuscole), `isOpen` (chiuso anche se il tempo è scaduto dopo l'ultima
    lettura), `hasVoted`, `canVote` (aperto e non ancora votato, o cambio ammesso), `shareOf`
    (percentuale 0–100 sul totale dei voti: con più scelte un votante conta su più opzioni),
    `leadingOptions` (le opzioni in testa, nessuna se non ha votato nessuno).
- `profile.ts`: `Profile` con completamenti, post e `photoCount` (le foto usate, solo sul
  proprio profilo, altrimenti `null`), `PHOTO_LIMIT` = 100 (foto per giocatore tra azioni, post
  e chat, esclusa la foto profilo; ADR 0018), `photosOf` (tutte le foto di un giocatore),
  `isValidBio` (500 caratteri).
- `player.ts`: `Player`, `Participant` (con foto profilo, azioni, punti), `Session` =
  `PlayerSession` (con `inboxKey`, la chiave segreta del canale della chat) | `AdminSession`,
  `IDENTITY_LIMITS` (nickname 2–20, nome vero 2–40), `validateIdentity`, `sameName`, `rankParticipants` (punti, poi azioni, poi nickname).
  Per la schermata admin "Utenti" (ADR 0018): `Permission` (`polls` | `challenges`),
  `Permissions`, `NO_PERMISSIONS` (il valore prima della prima lettura), `ManagedPlayer` (il
  giocatore visto dall'admin: bloccato o no, permessi, foto usate, ora di ingresso),
  `matchesSearch` (per nickname o nome vero, senza distinguere maiuscole e accenti: "gia"
  trova "Giàcomo").
- `text.ts`: `normalizeText`. `result.ts`: `Result<T, E>` con `ok` / `err`.

## Relazioni
- Dipende da: nessuno.
- Usato da: tutti gli altri moduli.
- Dati posseduti: nessuno (solo definizioni).

Le stesse regole sono applicate anche dal database (`supabase/migrations`), che resta
l'autorità finale: il dominio serve a rispondere subito e a spiegarle nell'interfaccia.
