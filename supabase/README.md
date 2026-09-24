# supabase — il database

Schema, regole di accesso e funzioni del backend reale (Postgres su Supabase). Motivazioni
in [ADR 0002](../docs/adr/0002-backend-supabase.md) e [ADR 0005](../docs/adr/0005-admin-e-serata-unica.md).

## Contenuto
- `migrations/`: lo schema, versionato. Ogni modifica è un file nuovo, mai la modifica di
  uno vecchio.
- `seed.sql`: il catalogo predefinito. GENERATO da `web/src/infrastructure/default-catalog.ts`
  con `npm run db:seed` (dalla cartella `web/`): non modificarlo a mano.
- `config.toml`: configurazione dello stack locale.

## Tabelle
| Tabella | Leggibile dai client | Contenuto |
|---|---|---|
| `actions` | sì | la lista delle azioni della serata (con i punti, non mostrati) |
| `players` | sì | i giocatori; nickname unico senza distinguere maiuscole |
| `player_counts` | sì | quante volte ogni giocatore ha fatto ogni azione |
| `shared_counts` | sì | i conteggi delle azioni "per tutti" |
| `sessions` | **no** | i token di accesso, di giocatori e admin |
| `admin_credentials` | **no** | nickname e nome reale dell'admin (modificabili dalla dashboard) |

Nessun client può scrivere direttamente nelle tabelle.

## API (funzioni RPC)
Sono l'unico modo di scrivere e rispecchiano le porte di `web/src/application/ports.ts`:
`join_game`, `resume_session`, `counts_for`, `participants`, `set_count`,
`admin_add_action`, `admin_remove_action`, `admin_reset_evening`. Le altre funzioni sono
interne e non sono eseguibili dai client.

## Relazioni
- Usato da: `web/src/infrastructure/supabase/supabase-backend.ts`, l'unico modulo che conosce
  queste tabelle e funzioni.
- Pubblica: modifiche in tempo reale (Realtime) di `actions`, `players`, `player_counts`,
  `shared_counts`.

## Comandi (da `web/`, serve Docker)
| Comando | Cosa fa |
|---|---|
| `npm run db:start` | avvia Supabase in locale (API su `http://127.0.0.1:54321`) |
| `npm run db:reset` | ricrea il database locale da migrazioni + seed |
| `npm run db:stop` | ferma lo stack locale |

Per usare l'app con il database locale, crea `web/.env.local` con `VITE_SUPABASE_URL` e
`VITE_SUPABASE_KEY` (i valori li stampa `db:start`).
