# supabase — il database

Schema, regole di accesso e funzioni del backend (Postgres su Supabase). Motivazioni negli
ADR 0002, 0005, 0007, 0008, 0010, 0011, 0012, 0013, 0014 (funzioni attivabili), 0015 (chat) e
0016 (chat come WhatsApp).

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
- `functions/photos/`: la Edge Function, unico punto che tocca i file (foto e file della chat).
- `config.toml`: configurazione dello stack locale.

## Tabelle
**Nessuna è leggibile dai client** (ADR 0011): si passa solo dalle funzioni.

| Tabella | Contenuto |
|---|---|
| `actions` | azioni: titolo, descrizione, tipo, punti (negativi per i malus), difficoltà, politica foto |
| `players` | giocatori: nickname unico, nome vero, bio, foto profilo, `inbox_key` (chiave segreta del canale della chat) |
| `player_completions` / `shared_completions` | azioni fatte (quelle "per tutti" una volta sola), con foto |
| `posts` | post della bacheca: foto + didascalia |
| `likes` | like su post e completamenti (`target_id`) |
| `sessions` | token di giocatori e admin |
| `admin_credentials` | nickname e nome vero dell'admin |
| `evening_settings` | la parola segreta della serata e gli interruttori `actions_enabled`, `feed_enabled`, `chat_enabled`, `leaderboard_enabled` (accesi di base; sopravvivono a "Termina e ricomincia") |
| `admin_access_log` | ogni accesso admin, con il dispositivo |
| `conversations` | una conversazione per coppia di giocatori (`player_a < player_b`), con l'ultima lettura di ciascuno (per i non letti) e, per lato a/b, `cleared_*_at` (i messaggi fino a lì non si vedono più: "Svuota"), `removed_*` (fuori dall'elenco finché non arriva un messaggio nuovo: "Cancella chat"), `marked_*` ("da leggere", vale un non letto). Due persone per conversazione: due colonne bastano, una tabella a parte sarebbe troppo |
| `messages` | messaggi: testo (≤ 1000 caratteri), foto o vocale (60 s nell'app, il database accetta fino a 65 s di tolleranza); il tipo (`kind`) decide quali colonne sono piene (vincolo `messages_shape`). `reply_to` (messaggio citato, della stessa conversazione), `edited_at` (solo testi), `forwarded`, `deleted_at`: "elimina per tutti" è una cancellazione morbida, la riga resta senza testo né file, così le risposte che la citano non si rompono |
| `message_hidden` | messaggi eliminati "per me" (messaggio, giocatore) |

Le foto stanno nel bucket PRIVATO `photos` (`full/<id>.jpg`, `thumb/<id>.jpg`); i file della
chat nel bucket PRIVATO `chat` (`photo/<id>.jpg`, `photo/<id>-thumb.jpg`, `voice/<id>.<ext>`).
Conversazioni e messaggi spariscono con i giocatori (cascade) a "Termina e ricomincia".

## API
- RPC senza token: `check_secret_word`, `join_game`, `resume_session`.
- RPC con token (ogni sessione): `catalog`, `participants`, `feed`, `profile`, `likers`,
  `features`. Giocatore: `completions_for`, `complete_action`, `toggle_like`, `update_bio`;
  chat: `open_conversation`, `conversations`, `conversation` (restituisce anche `otherInbox`,
  per il "sta scrivendo" prima di qualsiasi messaggio), `messages` (con risposta citata,
  modificato, inoltrato, eliminato), `mark_read`, `mark_unread`, `clear_conversation`
  (svuota o cancella, solo per chi lo chiede), `send_message` (con `p_reply_to`),
  `edit_message` (solo i propri testi, senza limiti di tempo), `hide_message` (elimina per me).
  Admin: `admin_add_action`, `admin_update_action`, `admin_secret_word`,
  `admin_set_secret_word`, `admin_access_log`, `admin_set_feature`. Un token sconosciuto dà
  l'errore `28000` (HTTP 403).
- Con una funzione spenta il server rifiuta con `disabled`: `svc_create_post` con la bacheca
  spenta, `open_conversation`, `send_message` e `svc_send_media` con la chat spenta.
- Edge Function `photos`: completamento con foto, post, foto profilo, link firmati, annulla,
  elimina foto / post, album, elimina azione, azzera serata (svuota anche il bucket `chat`);
  per la chat `chat-photo` e `chat-voice` (accettano `replyTo`), `chat-media` (link firmati
  solo ai due partecipanti), `delete-message` (elimina per tutti: toglie il file e restituisce
  `conversationId`) e `forward` (fino a 5 chat). L'inoltro crea copie con file nuovi, copiati
  nello storage con `storage.copy`: con un file condiviso, eliminare una copia romperebbe le
  altre. Se la copia di un file fallisce, il messaggio copiato si toglie (`svc_drop_message`).
  Usa le funzioni `svc_*` (tra cui `svc_send_media` con `p_reply_to`, `svc_delete_message`,
  `svc_forward_message`, `svc_drop_message`, `svc_chat_media`), eseguibili solo dal
  `service_role`.
- Funzioni di appoggio: `cleared_at_for` e `read_at_for` (la colonna del lato giusto),
  `visible_messages` (ciò che un giocatore vede ancora: né svuotato né eliminato per lui),
  `valid_reply` (la risposta punta a un messaggio della stessa conversazione).
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
  `photos-function.ts`), l'unico modulo che conosce queste tabelle e funzioni.
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
