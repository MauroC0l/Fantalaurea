# supabase — il database

Schema, regole di accesso e funzioni del backend (Postgres su Supabase). Motivazioni negli
ADR 0002, 0005, 0007, 0008, 0010, 0011, 0012, 0013, 0014 (funzioni attivabili), 0015 (chat),
0016 (chat come WhatsApp), 0018 (utenti: blocco, permessi, limite di 100 foto), 0019
(sondaggi), 0020 (sfide a tempo) e 0021 (sfide ovunque, bacheca in due sezioni, durata libera).

## Contenuto
- `migrations/`: lo schema, versionato. Ogni modifica è un file nuovo, mai la modifica di
  uno già applicato in produzione.
- `migrations/20260924130000_default_catalog.sql`: la lista predefinita delle azioni. È una
  migrazione e non un seed perché deve arrivare anche in produzione (la CLI non riesegue un
  seed già applicato).
- `migrations/20260925180000_features_and_chat.sql`: interruttori della serata e chat privata.
- `migrations/20260925200000_chat_like_whatsapp.sql`: rispondi, modifica, inoltra, elimina per
  me / per tutti, svuota, cancella chat, segna come da leggere (ADR 0016).
- `migrations/20260925210000_actions_switch_and_short_nicknames.sql`: interruttore `actions_enabled`
  (`complete_action` e `svc_complete_with_photo` rispondono `disabled` se spento) e nickname
  nuovi o cambiati al massimo di 20 caratteri. Il limite è un trigger (`short_nickname`) e non un
  vincolo di colonna, perché un vincolo ricontrollerebbe ogni modifica della riga: chi ha già un
  nickname più lungo non potrebbe più cambiare bio o foto.
- `migrations/20260925220000_users_block_permissions_photo_limit.sql` (ADR 0018): blocco dei
  giocatori, permessi per giocatore, limite di 100 foto; ridefinisce le funzioni che leggono o
  scrivono contenuti dei giocatori perché ignorino i bloccati e contino le foto.
- `migrations/20260925230000_polls.sql` (ADR 0019): sondaggi. Tabelle `polls`, `poll_options`,
  `poll_votes`, enum `poll_results`, interruttore `polls_enabled` (`features` e
  `admin_set_feature` accettano `polls`); `svc_reset_evening` ora cancella anche i sondaggi,
  perché quelli dell'admin non hanno un giocatore da cui sparire a cascata.
- `migrations/20260926000000_challenges.sql` (ADR 0020): sfide a tempo. Tabelle `challenges` e
  `challenge_completions`, interruttore `challenges_enabled` (`features` e `admin_set_feature`
  accettano `challenges`); `participants` somma anche completamenti e punti delle sfide;
  `svc_reset_evening` cancella anche le sfide, per lo stesso motivo dei sondaggi.
- `migrations/20260926000100_hidden_poll_votes.sql`: `vote_poll` rifiuta (`rejected`) un
  sondaggio creato da un bloccato. È già nascosto dall'elenco, ma senza questo controllo lo si
  potrebbe ancora votare conoscendone l'id.
- `migrations/20260926010000_challenges_everywhere.sql` (ADR 0021): `challenge_completions`
  riceve un `id` (per i "mi piace" in bacheca) e un trigger che ne cancella i like quando la riga
  sparisce; sfide fino a 720 minuti (12 ore) in `create_challenge` e `update_challenge`; nuova
  RPC `challenge_completers`; `profile` restituisce anche le sfide; `feed` diviso in due sezioni,
  con le sfide completate tra le imprese; `toggle_like` accetta anche i completamenti delle sfide.
- `functions/photos/`: la Edge Function, unico punto che tocca i file (foto e file della chat).
- `config.toml`: configurazione dello stack locale.

## Tabelle
**Nessuna è leggibile dai client** (ADR 0011): si passa solo dalle funzioni.

| Tabella | Contenuto |
|---|---|
| `actions` | azioni: titolo, descrizione, tipo, punti (negativi per i malus), difficoltà, politica foto |
| `players` | giocatori: nickname unico, nome vero, bio, foto profilo, `inbox_key` (chiave segreta del canale della chat), `blocked_at` (bloccato dall'admin, `null` se no), `can_create_polls` / `can_create_challenges` (permessi, spenti di base) |
| `player_completions` / `shared_completions` | azioni fatte (quelle "per tutti" una volta sola), con foto |
| `posts` | post della bacheca: foto + didascalia |
| `likes` | like su post, completamenti delle azioni e completamenti delle sfide (`target_id`); un trigger per tabella li cancella quando il bersaglio sparisce |
| `sessions` | token di giocatori e admin |
| `admin_credentials` | nickname e nome vero dell'admin |
| `evening_settings` | la parola segreta della serata e gli interruttori `actions_enabled`, `feed_enabled`, `chat_enabled`, `leaderboard_enabled`, `polls_enabled`, `challenges_enabled` (accesi di base; sopravvivono a "Termina e ricomincia") |
| `admin_access_log` | ogni accesso admin, con il dispositivo |
| `conversations` | una conversazione per coppia di giocatori (`player_a < player_b`), con l'ultima lettura di ciascuno (per i non letti) e, per lato a/b, `cleared_*_at` (i messaggi fino a lì non si vedono più: "Svuota"), `removed_*` (fuori dall'elenco finché non arriva un messaggio nuovo: "Cancella chat"), `marked_*` ("da leggere", vale un non letto). Due persone per conversazione: due colonne bastano, una tabella a parte sarebbe troppo |
| `messages` | messaggi: testo (≤ 1000 caratteri), foto o vocale (60 s nell'app, il database accetta fino a 65 s di tolleranza); il tipo (`kind`) decide quali colonne sono piene (vincolo `messages_shape`). `reply_to` (messaggio citato, della stessa conversazione), `edited_at` (solo testi), `forwarded`, `deleted_at`: "elimina per tutti" è una cancellazione morbida, la riga resta senza testo né file, così le risposte che la citano non si rompono |
| `message_hidden` | messaggi eliminati "per me" (messaggio, giocatore) |
| `polls` | sondaggi: domanda, autore (`creator_id`, `null` = l'admin), regole (`anonymous`, `multiple`, `results` di tipo `poll_results`: `always` / `after-vote` / `after-close`, `vote_change`, `close_when_all_voted`: dall'ADR 0021 l'app la manda sempre falsa, la colonna resta per non cambiare il contratto della RPC), `closes_at` (scadenza a tempo), `closed_at` (chiuso a mano o all'ultimo voto). **Un sondaggio a tempo non viene mai segnato chiuso:** lo è quando `closes_at` è passato; chi legge la tabella a mano deve ragionare come `poll_is_closed` |
| `poll_options` | da 2 a 10 opzioni per sondaggio, ordinate da `position` |
| `poll_votes` | una riga per opzione scelta (opzione, giocatore): un voto multiplo sono più righe |
| `challenges` | sfide a tempo: titolo (2–40), descrizione (≤ 300), punti (1–100), `winners_limit` (1–50, `null` = tutti quelli che la completano in tempo), `starts_at`, `ends_at`, autore (`creator_id`, `null` = l'admin). Come un sondaggio a tempo, **una sfida finita non viene segnata**: lo è quando `ends_at` è passato |
| `challenge_completions` | una riga per giocatore e sfida, con `id` (bersaglio dei "mi piace") e `completed_at`: l'ordine di arrivo decide chi sta tra i primi N. **I punti non si salvano:** si calcolano a ogni lettura (`challenge_points_of`), così cambiare limite o punti, annullare o eliminare non richiede ricalcoli |

Le foto stanno nel bucket PRIVATO `photos` (`full/<id>.jpg`, `thumb/<id>.jpg`); i file della
chat nel bucket PRIVATO `chat` (`photo/<id>.jpg`, `photo/<id>-thumb.jpg`, `voice/<id>.<ext>`).
Conversazioni, messaggi, voti e completamenti delle sfide spariscono con i giocatori (cascade) a
"Termina e ricomincia"; sondaggi e sfide li cancella `svc_reset_evening` esplicitamente.

## API
- RPC senza token: `check_secret_word`, `join_game`, `resume_session`.
- RPC con token (ogni sessione): `catalog`, `participants`, `feed`, `profile`, `likers`,
  `features`, `permissions` (cosa può creare: l'admin tutto). `profile` restituisce
  `photoCount` solo sul proprio profilo ("Ne usi N di 100"), `null` sugli altri, e le sfide
  completate (`challenges`: `id`, `challengeId`, `title`, `points`, `completedAt`, `earned`, cioè
  se è arrivato tra i primi N). `feed(token, before, limit, section)` (ADR 0021): `section` è
  `posts` (i post) oppure `deeds` (le imprese: azioni completate e sfide completate, queste con
  `item_kind` `challenge`, senza foto, tipo `bonus` e i punti della sfida); ogni sezione ha la
  sua paginazione. Giocatore: `completions_for`, `complete_action`, `toggle_like`, `update_bio`;
  chat: `open_conversation`, `conversations`, `conversation` (restituisce anche `otherInbox`,
  per il "sta scrivendo" prima di qualsiasi messaggio), `messages` (con risposta citata,
  modificato, inoltrato, eliminato), `mark_read`, `mark_unread`, `clear_conversation`
  (svuota o cancella, solo per chi lo chiede), `send_message` (con `p_reply_to`),
  `edit_message` (solo i propri testi, senza limiti di tempo), `hide_message` (elimina per me).
  Admin: `admin_add_action`, `admin_update_action`, `admin_secret_word`,
  `admin_set_secret_word`, `admin_access_log`, `admin_set_feature`, `admin_players` (tutti,
  bloccati compresi, con permessi e foto usate), `admin_block_player` (blocca o sblocca;
  bloccare cancella anche le sessioni del giocatore, così il suo telefono alla lettura
  successiva riceve 403 ed esce), `admin_set_permission` (`polls` | `challenges`). Un token
  sconosciuto dà l'errore `28000` (HTTP 403).
- Sondaggi (ADR 0019), con il token di giocatori e admin:
  - `polls` (jsonb): i sondaggi visibili, aperti prima. Conteggi (`votes`) e votanti (`voters`)
    escono dal database **solo quando le regole lo permettono** (`always`, sondaggio chiuso, o
    `after-vote` dopo il proprio voto), altrimenti sono `null`: nasconderli solo nell'interfaccia
    sarebbe finto, si leggerebbero dalla rete. L'admin vede sempre i conteggi, mai i nomi di un
    sondaggio anonimo. Ogni sondaggio porta anche `myVotes`, `voterCount`, `canManage`,
    `resultsVisible`.
  - `create_poll` → `{status, pollId}`, `status` tra `ok`, `unauthorized`, `forbidden` (giocatore
    senza `can_create_polls`), `rejected` (servono 2–10 opzioni non vuote e diverse, durata tra 1
    e 1440 minuti), `disabled`.
  - `vote_poll` (solo giocatori: l'admin non vota) → `ok`, `unauthorized`, `disabled`, `closed`,
    `locked` (ha già votato e il cambio non è ammesso), `rejected`. Sostituisce i voti precedenti;
    con `close_when_all_voted`, se hanno votato tutti i giocatori non bloccati scrive
    `closed_at`: chi entra dopo non riapre il sondaggio. Dall'ADR 0021 l'app non la attiva più.
  - `close_poll` e `delete_poll` (autore o admin) → `ok`, `unauthorized`, `rejected`.
  - I voti dei bloccati non contano e i sondaggi creati da loro non si vedono né si votano.
- Sfide a tempo (ADR 0020), con il token di giocatori e admin:
  - `challenges` (jsonb): le sfide visibili, in corso prima (quella che scade prima in testa),
    poi le finite. Ognuna porta `ended`, `creator`, `canManage`, `completions`, `mine`
    (`{at, rank}`: quando e in che posizione l'ho fatta, `null` se no) e `winners` (i primi
    `winnersLimit`, al massimo 50, bloccati esclusi). Le sfide dei bloccati non si vedono.
  - `challenge_completers(token, sfida)` (ADR 0021): tutti quelli che l'hanno completata, in
    ordine di arrivo, con `rank` ed `earned` (tra i primi `winners_limit`); i bloccati non
    compaiono.
  - `create_challenge` → `{status, challengeId}`, `status` tra `ok`, `unauthorized`, `forbidden`
    (giocatore senza `can_create_challenges`), `rejected` (valori fuori dai vincoli, durata fuori
    da 1–720 minuti, cioè 12 ore), `disabled`.
  - `update_challenge` (autore o admin) → `ok`, `unauthorized`, `rejected`. `p_extend_minutes`
    `null` lascia la scadenza; un numero (1–720) la sposta ad **adesso** + minuti e riapre anche una
    sfida finita. Abbassare il limite toglie i punti a chi resta fuori.
  - `end_challenge` (scadenza ad adesso) e `delete_challenge` (toglie i punti a chi l'aveva
    fatta), autore o admin → `ok`, `unauthorized`, `rejected`.
  - `complete_challenge` (solo giocatori: l'admin non partecipa) → `ok` (anche se già fatta),
    `unauthorized`, `disabled`, `ended`, `full` (i primi N l'hanno già presa), `rejected`.
    **Blocca la riga della sfida** (`for update`) mentre conta: due telefoni che premono insieme
    non diventano entrambi l'N-esimo.
  - `undo_challenge` → `ok` o `rejected`: si annulla solo mentre la sfida è in corso, dopo il
    risultato resta.
- Blocco (ADR 0018): i contenuti di un bloccato si nascondono, non si cancellano, così
  "Sblocca" rimette tutto. `join_game` risponde `blocked` se il nickname **o il nome vero**
  coincide con quello di un bloccato (un nickname nuovo non basta per rientrare). `feed`,
  `participants`, `profile`, `likers` (elenco e conteggio), `conversations` e `conversation`
  lo ignorano; `open_conversation`, `send_message`, `svc_send_media` e `svc_forward_message`
  rifiutano una chat con lui. L'admin continua a vedere tutto (album, `admin_players`).
- Limite di 100 foto (ADR 0018): contano le foto che esistono ora (azioni, post, chat), non la
  foto profilo, così cancellarne una libera il posto. `svc_complete_with_photo` (solo per
  un'azione nuova: sostituire la foto non conta), `svc_create_post`, `svc_send_media` (foto) e
  `svc_forward_message` (una foto inoltrata a N chat vale N) rispondono `photo-limit`.
- Con una funzione spenta il server rifiuta con `disabled`: `svc_create_post` con la bacheca
  spenta, `open_conversation`, `send_message` e `svc_send_media` con la chat spenta,
  `create_poll` e `vote_poll` con i sondaggi spenti, `create_challenge` e `complete_challenge`
  con le sfide spente (modificare, terminare ed eliminare quelle esistenti resta possibile).
- Edge Function `photos`: completamento con foto, post, foto profilo, link firmati, annulla,
  elimina foto / post, album, elimina azione, azzera serata (svuota anche il bucket `chat`);
  per la chat `chat-photo` e `chat-voice` (accettano `replyTo`), `chat-media` (link firmati
  solo ai due partecipanti), `delete-message` (elimina per tutti: toglie il file e restituisce
  `conversationId`) e `forward` (fino a 5 chat). L'inoltro crea copie con file nuovi, copiati
  nello storage con `storage.copy`: con un file condiviso, eliminare una copia romperebbe le
  altre. Se la copia di un file fallisce, il messaggio copiato si toglie (`svc_drop_message`).
  Usa le funzioni `svc_*` (tra cui `svc_send_media` con `p_reply_to`, `svc_delete_message`,
  `svc_forward_message`, `svc_drop_message`, `svc_chat_media`, `svc_photo_room`), eseguibili
  solo dal `service_role`. `complete`, `post` e `chat-photo` chiedono `svc_photo_room`
  **prima** di caricare e rispondono `photo-limit`: una foto rifiutata non costa il
  caricamento. Due foto nello stesso istante possono passare il controllo; la funzione SQL le
  ferma comunque al salvataggio.
- Funzioni di appoggio: `cleared_at_for` e `read_at_for` (la colonna del lato giusto),
  `visible_messages` (ciò che un giocatore vede ancora: né svuotato né eliminato per lui),
  `valid_reply` (la risposta punta a un messaggio della stessa conversazione), `is_blocked`,
  `photos_of` (le foto esistenti di un giocatore) e `has_photo_room(giocatore, quante)` (la
  costante 100 sta qui, speculare a `PHOTO_LIMIT` del dominio). Per i sondaggi:
  `polls_enabled()`, `poll_is_closed` (chiuso a mano, all'ultimo voto o scaduto),
  `can_manage_poll` (admin o autore) e `poll_voters` (quanti hanno votato, bloccati esclusi).
  Per le sfide: `challenges_enabled()`, `challenge_points_of` (somma i punti dei completamenti
  arrivati tra i primi `winners_limit`), `challenges_done_by` (quante ne ha fatte, anche fuori
  dai primi N: contano tra le azioni fatte), `can_manage_challenge` (admin o autore) e
  `may_create_challenges` (admin o giocatore con il permesso).
- Chi invia, modifica, elimina o inoltra un messaggio riceve nella risposta la `inbox_key` del
  destinatario, per avvisarlo (vedi sotto).

### Limiti di cui tiene conto la funzione `photos`
- Lo Storage rifiuta di firmare o cancellare troppi file in una richiesta: l'album di una
  serata (oltre 1000 percorsi) falliva. Firma e rimozione vanno a gruppi di 200 percorsi
  (`STORAGE_BATCH`).
- PostgREST restituisce al massimo 1000 righe per chiamata (`max_rows` in `config.toml`, uguale
  sul progetto ospitato), senza errore: l'album legge `svc_photos` a pagine di 1000 finché una
  pagina arriva più corta, altrimenti verrebbe troncato in silenzio.

## Tempo reale
Nessun dato viaggia. Dopo ogni scrittura è il client che l'ha fatta ad annunciare sul canale
broadcast pubblico `fantalaurea` l'evento `changed` con il solo nome della tabella; gli altri
rileggono con il loro token (ADR 0013). Il database non manda segnali: sul Supabase ospitato i
broadcast generati dal database non arrivano ai canali pubblici.

La chat usa un canale per giocatore, `inbox:<inbox_key>`, con il solo id della conversazione
(ADR 0015): evento `message` (qualcosa è cambiato, rileggi) e `typing` ("sta scrivendo", ADR
0016, mai salvato nel database: varrebbe scritture continue per un'informazione che dura 5 s).
La chiave è casuale e la conoscono il suo proprietario (arriva con la sessione), il server e le
persone con cui ha una chat: chi guarda i canali pubblici non scopre chi scrive a chi.

## Relazioni
- Usato da: `web/src/infrastructure/supabase/` (`supabase-backend.ts`, `supabase-chat.ts`,
  `supabase-polls.ts`, `supabase-challenges.ts`, `photos-function.ts`), l'unico modulo che conosce queste tabelle e funzioni.
- Attenzione: cancellare righe dalla dashboard lascia file orfani nei bucket; usare l'app.

## Comandi (da `web/`, serve Docker)
| Comando | Cosa fa |
|---|---|
| `npm run db:start` | avvia Supabase in locale (API su `http://127.0.0.1:54321`) |
| `npm run db:reset` | ricrea il database locale dalle migrazioni |
| `npm run db:stop` | ferma lo stack locale |
| `npm run db:deploy` | pubblica migrazioni e funzione in produzione (serve `supabase login` + `link`) |

Per usare l'app con il database locale, crea `web/.env.development.local` con `VITE_SUPABASE_URL` e
`VITE_SUPABASE_KEY` (i valori li stampa `db:start`).
