# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `supabase/supabase-client.ts`: `createSupabaseClient`, l'unico client dell'app. Partita,
  chat e tempo reale ne condividono la connessione.
- `supabase/change-signals.ts`: `ChangeSignals`, i segnali "la tabella X è cambiata" tra i
  telefoni (ADR 0013):
  - un solo canale broadcast `fantalaurea`, condiviso da tutti gli adattatori che scrivono
    (partita, sondaggi, sfide);
  - `announce(tables)` invia via HTTP se il canale non è collegato, e avvisa subito anche le
    schermate di questo telefono;
  - `onChange` raggruppa i segnali (300 ms) e, al risveglio del telefono, segnala tutte le
    tabelle di `CHANGED_TABLES` (l'elenco sta nelle porte, quindi una tabella nuova non può
    essere dimenticata).
- `supabase/photos-function.ts`: come si chiama la Edge Function `photos`, in comune tra
  backend e chat. `invokePhotos` traduce la risposta in un `Result` (`FunctionFailureReason` =
  `FeatureFailure` | `PhotoLimitFailure`). Tre adattatori restringono l'errore a ciò che
  l'operazione può davvero ricevere, trasformando il resto in `rejected`:
  - `asWriteFailure`: né interruttore né limite (`disabled` e `photo-limit` → `rejected`);
  - `asFeatureFailure`: interruttore sì, limite no, come i vocali (`photo-limit` → `rejected`);
  - `asPhotoWrite`: limite sì, interruttore proprio no, come le foto delle azioni (`disabled` →
    `rejected`, `photo-limit` resta).

  Così la firma di ogni porta dice solo gli errori possibili e le schermate non gestiscono casi
  che non arrivano mai. `absoluteUrl` aggiunge l'indirizzo del server ai link (la funzione li
  restituisce senza host: l'indirizzo interno dello stack locale non è raggiungibile).
- `supabase/supabase-backend.ts`: `SupabaseBackend(client, url, options)` implementa
  `PlayerAccounts`, `GameBoard`, `PlayerMoves`, `EveningAdmin` e `PhotoLinkProvider`.
  - Tutte le letture sono funzioni RPC con il token; il codice `28000` diventa
    `SessionExpiredError`.
  - Ciò che tocca i file passa dalla Edge Function `photos` (ADR 0008).
  - I link firmati (12 ore) sono tenuti in una cache: ogni foto si chiede una volta sola.
  - `features` / `setFeature`: gli interruttori della serata (RPC `features`,
    `admin_set_feature`); cambiarne uno annuncia `evening_settings`.
  - Utenti (ADR 0018): `players` (RPC `admin_players`), `setBlocked` (`admin_block_player`;
    annuncia `players`, `sessions` e `posts`: gli altri rileggono senza il bloccato, il suo
    telefono scopre di non avere più la sessione), `setPermission` (`admin_set_permission`,
    annuncia `players`), `permissions` (RPC `permissions`).
  - `completeWithPhoto` usa `asPhotoWrite`, `createPost` lascia passare `disabled` e
    `photo-limit`.
  - Dopo ogni scrittura riuscita annuncia le tabelle cambiate con `ChangeSignals`, che riceve
    nel costruttore; `onChange` delega a lui.
  - Nel log admin invia lo user agent del telefono.
- `supabase/supabase-chat.ts`: `SupabaseChat(client, url)` implementa `Chat` (ADR 0015, 0016).
  - Letture, testo e ciò che non tocca file con le RPC (`conversations`, `conversation`,
    `messages`, `open_conversation`, `send_message` con `p_reply_to`, `edit_message`,
    `mark_read`, `mark_unread`, `clear_conversation`, `hide_message` per "elimina per me");
    foto, vocali, link dei file, "elimina per tutti" e inoltro con la Edge Function
    (`chat-photo` / `chat-voice` con `replyTo`, `chat-media`, `delete-message`, `forward`).
    `sendPhoto` e `forward` lasciano passare `photo-limit`; `sendVoice` usa `asFeatureFailure`.
  - I link dei file sono tenuti in una cache per messaggio, come quelli delle foto; un
    messaggio eliminato per tutti esce dalla cache.
  - Tempo reale: ogni giocatore ascolta il proprio canale `inbox:<inboxKey>`, con due eventi che
    portano solo `{ conversationId }`: `message` (qualcosa è cambiato) e `typing` ("sta
    scrivendo"). Un solo canale per telefono porta entrambi: due canali sullo stesso topic si
    disturbano. Chi invia, modifica, elimina o inoltra riceve dal server la chiave del
    destinatario e lo avvisa lì con `httpSend`, senza doversi collegare al canale; avvisa
    subito anche le schermate di questo telefono. Anche l'eliminazione restituisce l'id della
    conversazione, così si ricarica solo quella.
  - Il "sta scrivendo" parte prima di qualsiasi messaggio, quindi la chiave dell'altra persona
    arriva da `conversation()` (campo `otherInbox`) ed è tenuta in memoria per conversazione.
  - `markUnread` e `clear` riguardano solo questo telefono: avvisano le schermate locali con id
    vuoto ("ricarica quello che mostri") e nessun altro.
  - `markRead` non avvisa le schermate locali: chi segna come letto è la conversazione, che
    riceverebbe il proprio segnale e rileggerebbe all'infinito. La lista la aggiorna
    `ConversationState` tramite `onRead`.
- `supabase/supabase-polls.ts`: `SupabasePolls(client, signals)` implementa `Polls` (ADR
  0019) con le RPC `polls`, `create_poll`, `vote_poll`, `close_poll`, `delete_poll`.
  - La risposta di `polls` diventa un `Poll` del dominio (date come `Date`, regole raccolte in
    `PollRules`, conteggi convertiti in numeri); i conteggi e i votanti nascosti restano `null`,
    come li manda il server.
  - Dopo ogni scrittura riuscita annuncia `polls` con lo stesso `ChangeSignals` della partita:
    un adattatore a parte e non altri metodi di `SupabaseBackend`, che è già grande, ma un solo
    canale per telefono.
  - Il codice `28000` nelle letture diventa `SessionExpiredError`, come nel backend.
- `supabase/supabase-challenges.ts`: `SupabaseChallenges(client, signals)` implementa
  `Challenges` (ADR 0020) con le RPC `challenges`, `create_challenge`, `update_challenge`,
  `end_challenge`, `delete_challenge`, `complete_challenge`, `undo_challenge`.
  - La risposta di `challenges` diventa una `Challenge` del dominio (date come `Date`, conteggi
    e posizione convertiti in numeri).
  - Dopo **ogni** scrittura riuscita annuncia `challenges`, anche per completare e annullare:
    i punti delle sfide entrano in `participants`, quindi la classifica ascolta anche questa
    tabella. Stesso `ChangeSignals` e stesso motivo di `SupabasePolls` per l'adattatore a parte.
  - Il codice `28000` nelle letture diventa `SessionExpiredError`.
- `supabase/supabase-backend.db-test.ts`: test d'integrazione contro lo stack locale
  (`npm run test:db`, ricrea il database locale), sondaggi e sfide compresi.
- `browser/canvas-photo-processor.ts`: decodifica (anche HEIC su Safari), orientamento,
  JPEG. `original`: 2560 px + miniatura 720 px; `square`: ritaglio centrale 512 px +
  miniatura 160 px (valori in `app/compose.ts`).
- `browser/browser-voice-recorder.ts`: `VoiceRecorder` con MediaRecorder. Preferisce
  `audio/mp4` (AAC) perché si riproduce su ogni telefono, mentre il WebM non suona sugli iPhone
  meno recenti; si ferma da solo al limite (`VOICE_MAX_MS`, passato da `app/compose.ts`) e
  rilascia il microfono.
- `browser/browser-photo-exporter.ts`: condivisione di file e di testo (Web Share API),
  download singolo e ZIP (`fflate`).
- `browser/browser-clipboard.ts`: copia negli appunti.
- `browser/safe-storage.ts`, `browser/storage-session-store.ts`: token in `localStorage`.
- `browser/vibration-haptics.ts`: Vibration API (su iOS non fa nulla).

## Relazioni
- Dipende da: `application/`, `domain/`, `@supabase/supabase-js`, `fflate`, lo schema e la
  funzione in `supabase/`.
- Usato da: `app/compose.ts` soltanto.
- Dati posseduti: la chiave `fantalaurea:session-token` in `localStorage`, le cache dei link
  (foto e file della chat).
- Ascolta e pubblica: il canale broadcast `fantalaurea` (solo nomi di tabelle) e i canali
  `inbox:<chiave>` (eventi `message` e `typing`, solo id di conversazione). Pubblica anche le
  notifiche di `GameBoard.onChange`, `Chat.onInbox` e `Chat.onTyping`.
