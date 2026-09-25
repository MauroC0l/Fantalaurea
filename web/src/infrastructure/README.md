# infrastructure

Implementazioni concrete delle porte definite in `application/ports.ts`.

## Contenuto
- `supabase/supabase-client.ts`: `createSupabaseClient`, l'unico client dell'app. Partita,
  chat e tempo reale ne condividono la connessione.
- `supabase/photos-function.ts`: come si chiama la Edge Function `photos`, in comune tra
  backend e chat. `invokePhotos` traduce la risposta in un `Result` (`FeatureFailure`),
  `asWriteFailure` trasforma `disabled` in `rejected` per le operazioni che nessun interruttore
  può bloccare, `absoluteUrl` aggiunge l'indirizzo del server ai link (la funzione li
  restituisce senza host: l'indirizzo interno dello stack locale non è raggiungibile).
- `supabase/supabase-backend.ts`: `SupabaseBackend(client, url, options)` implementa
  `PlayerAccounts`, `GameBoard`, `PlayerMoves`, `EveningAdmin` e `PhotoLinkProvider`.
  - Tutte le letture sono funzioni RPC con il token; il codice `28000` diventa
    `SessionExpiredError`.
  - Ciò che tocca i file passa dalla Edge Function `photos` (ADR 0008).
  - I link firmati (12 ore) sono tenuti in una cache: ogni foto si chiede una volta sola.
  - `features` / `setFeature`: gli interruttori della serata (RPC `features`,
    `admin_set_feature`); cambiarne uno annuncia `evening_settings`.
  - Dopo ogni scrittura riuscita annuncia sul canale broadcast `fantalaurea` quali tabelle
    sono cambiate (via HTTP se il canale non è collegato) e avvisa subito anche le schermate
    di questo telefono (ADR 0013).
  - `onChange` ascolta quel canale, raggruppa i segnali (300 ms) e al ritorno in primo piano
    del telefono segnala tutte le tabelle.
  - Nel log admin invia lo user agent del telefono.
- `supabase/supabase-chat.ts`: `SupabaseChat(client, url)` implementa `Chat` (ADR 0015, 0016).
  - Letture, testo e ciò che non tocca file con le RPC (`conversations`, `conversation`,
    `messages`, `open_conversation`, `send_message` con `p_reply_to`, `edit_message`,
    `mark_read`, `mark_unread`, `clear_conversation`, `hide_message` per "elimina per me");
    foto, vocali, link dei file, "elimina per tutti" e inoltro con la Edge Function
    (`chat-photo` / `chat-voice` con `replyTo`, `chat-media`, `delete-message`, `forward`).
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
- `supabase/supabase-backend.db-test.ts`: test d'integrazione contro lo stack locale
  (`npm run test:db`, ricrea il database locale).
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
