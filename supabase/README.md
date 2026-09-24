# supabase — il database

Schema, regole di accesso e funzioni del backend reale (Postgres su Supabase). Motivazioni
in [ADR 0002](../docs/adr/0002-backend-supabase.md) e [ADR 0005](../docs/adr/0005-admin-e-serata-unica.md).

## Contenuto
- `migrations/`: lo schema, versionato. Ogni modifica è un file nuovo, mai la modifica di
  uno vecchio.
- `migrations/20260924130000_default_catalog.sql`: la lista predefinita delle azioni. È una
  migrazione e non un seed perché deve arrivare anche in produzione: la CLI non riesegue un
  seed già applicato. Dopo il primo avvio le azioni si cambiano dal pannello admin.
- `config.toml`: configurazione dello stack locale.

## Tabelle
| Tabella | Leggibile dai client | Contenuto |
|---|---|---|
| `actions` | sì | le azioni della serata: titolo, descrizione, tipo, politica foto, punti (non mostrati) |
| `players` | sì | i giocatori; nickname unico senza distinguere maiuscole |
| `player_completions` | sì | azioni fatte da ogni giocatore, con l'id dell'eventuale foto |
| `shared_completions` | sì | azioni "per tutti" fatte (una riga per azione, con chi l'ha segnata) |
| `sessions` | **no** | i token di accesso, di giocatori e admin |
| `admin_credentials` | **no** | nickname e nome reale dell'admin (modificabili dalla dashboard) |

Nessun client può scrivere direttamente nelle tabelle. Le foto stanno nel bucket PRIVATO
`photos` (`full/<id>.jpg` e `thumb/<id>.jpg`), accessibile solo alla funzione `photos`.

## API
- RPC per i client: `join_game`, `resume_session`, `participants`, `completions_for`,
  `complete_action`, `admin_add_action`, `admin_update_action`.
- Edge Function `functions/photos` (unico punto che tocca i file, ADR 0008): completamento
  con foto, annulla, elimina foto, foto proprie, album, elimina azione, azzera serata. Usa le
  funzioni SQL `svc_*`, eseguibili solo dal `service_role`.
- Le altre funzioni sono interne e non eseguibili dai client.

## Relazioni
- Usato da: `web/src/infrastructure/supabase/supabase-backend.ts`, l'unico modulo che conosce
  queste tabelle e funzioni.
- Pubblica: modifiche in tempo reale (Realtime) di `actions`, `players`,
  `player_completions`, `shared_completions`.
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
