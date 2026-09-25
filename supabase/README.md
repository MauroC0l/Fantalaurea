# supabase — il database

Schema, regole di accesso e funzioni del backend (Postgres su Supabase). Motivazioni negli
ADR 0002, 0005, 0007, 0008, 0010, 0011 e 0012.

## Contenuto
- `migrations/`: lo schema, versionato. Ogni modifica è un file nuovo, mai la modifica di
  uno già applicato in produzione.
- `migrations/20260924130000_default_catalog.sql`: la lista predefinita delle azioni. È una
  migrazione e non un seed perché deve arrivare anche in produzione (la CLI non riesegue un
  seed già applicato).
- `functions/photos/`: la Edge Function, unico punto che tocca i file delle foto.
- `config.toml`: configurazione dello stack locale.

## Tabelle
**Nessuna è leggibile dai client** (ADR 0011): si passa solo dalle funzioni.

| Tabella | Contenuto |
|---|---|
| `actions` | azioni: titolo, descrizione, tipo, punti (negativi per i malus), difficoltà, politica foto |
| `players` | giocatori: nickname unico, nome vero, bio, foto profilo |
| `player_completions` / `shared_completions` | azioni fatte (quelle "per tutti" una volta sola), con foto |
| `posts` | post della bacheca: foto + didascalia |
| `likes` | like su post e completamenti (`target_id`) |
| `sessions` | token di giocatori e admin |
| `admin_credentials` | nickname e nome vero dell'admin |
| `evening_settings` | la parola segreta della serata |
| `admin_access_log` | ogni accesso admin, con il dispositivo |

Le foto stanno nel bucket PRIVATO `photos` (`full/<id>.jpg`, `thumb/<id>.jpg`).

## API
- RPC senza token: `check_secret_word`, `join_game`, `resume_session`.
- RPC con token (ogni sessione): `catalog`, `participants`, `feed`, `profile`, `likers`.
  Giocatore: `completions_for`, `complete_action`, `toggle_like`, `update_bio`. Admin:
  `admin_add_action`, `admin_update_action`, `admin_secret_word`, `admin_set_secret_word`,
  `admin_access_log`. Un token sconosciuto dà l'errore `28000` (HTTP 403).
- Edge Function `photos`: completamento con foto, post, foto profilo, link firmati, annulla,
  elimina foto / post, album, elimina azione, azzera serata. Usa le funzioni `svc_*`,
  eseguibili solo dal `service_role`.

## Tempo reale
Nessun dato viaggia. Dopo ogni scrittura è il client che l'ha fatta ad annunciare sul canale
broadcast pubblico `fantalaurea` l'evento `changed` con il solo nome della tabella; gli altri
rileggono con il loro token (ADR 0013). Il database non manda segnali: sul Supabase ospitato i
broadcast generati dal database non arrivano ai canali pubblici.

## Relazioni
- Usato da: `web/src/infrastructure/supabase/supabase-backend.ts`, l'unico modulo che conosce
  queste tabelle e funzioni.
- Attenzione: cancellare righe dalla dashboard lascia file orfani nel bucket; usare l'app.

## Comandi (da `web/`, serve Docker)
| Comando | Cosa fa |
|---|---|
| `npm run db:start` | avvia Supabase in locale (API su `http://127.0.0.1:54321`) |
| `npm run db:reset` | ricrea il database locale dalle migrazioni |
| `npm run db:stop` | ferma lo stack locale |
| `npm run db:deploy` | pubblica migrazioni e funzione in produzione (serve `supabase login` + `link`) |

Per usare l'app con il database locale, crea `web/.env.development.local` con `VITE_SUPABASE_URL` e
`VITE_SUPABASE_KEY` (i valori li stampa `db:start`).
