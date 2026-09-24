# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-24

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente: ci si reiscrive e alla fine i dati si buttano. L'app si usa quasi solo da
telefono. I giocatori si iscrivono con nickname + nome reale, segnano (anche più volte) le
azioni compiute e vedono i partecipanti con il numero di azioni. Un admin gestisce la lista
e la serata. Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`. Commit e push autorizzati liberamente (2026-09-24).
- ADR 0001: SPA Svelte 5 + TypeScript + Vite, routing via hash.
- ADR 0002: Supabase gratuito; scritture solo tramite funzioni RPC.
- ADR 0003: identità = nickname + nome reale.
- ADR 0004: livelli + porte; `MemoryBackend` e `SupabaseBackend` sono intercambiabili.
- ADR 0005: admin `Administrator` / `admin`, confermato dall'utente anche in produzione
  pur sapendo che il repo è pubblico ("app banale"). Serata unica con azzeramento.
- Pubblicazione: GitHub Pages tramite GitHub Actions. La configurazione Supabase del cloud
  andrà in `web/.env.production` (URL + chiave publishable, pubblica per natura).

## Stato attuale (verificato 2026-09-24)
- Pushati su GitHub (pubblico) i commit fino al pannello admin. Il lavoro su Supabase e il
  deploy vanno nel commit successivo.
- `supabase/migrations/20260924000000_schema.sql` + `seed.sql` generato. Provati sullo stack
  locale (Docker):
  - le RPC rispondono correttamente;
  - la RLS blocca le scritture dirette;
  - `sessions` e `admin_credentials` non sono leggibili.
- `SupabaseBackend` provato con 3 browser separati sul DB locale: tempo reale tra i telefoni,
  bonus comune, aggiunta di azioni dall'admin e azzeramento → i giocatori tornano alle regole.
- `web/.env.local` (non versionato) punta al Supabase locale.
- 29 test verdi, check pulito. Bundle circa 91 kB gzip (supabase-js).

## In corso / prossimi passi
1. L'utente crea il progetto Supabase cloud (regione Frankfurt) e manda Project URL +
   chiave publishable.
2. Si applica lo schema al cloud (CLI `supabase link` + `db push --include-seed`, oppure SQL
   Editor).
3. Claude crea `web/.env.production` e fa push; l'utente abilita GitHub Pages (Settings →
   Pages → Source: GitHub Actions). URL atteso: https://maurocol.github.io/Fantalaurea/
4. Prova con telefoni veri entro il 2026-09-30.

## Trappole
- Supabase gratuito va in pausa dopo 7 giorni senza traffico: riattivarlo prima di ogni festa.
- Il workflow di deploy fallisce finché GitHub Pages non è abilitato.
- Lo stack locale richiede Docker Desktop acceso (`npm run db:start` da `web/`).
- Se si cambia `default-catalog.ts`, rigenerare `seed.sql` con `npm run db:seed`.
- Niente Python e niente `gh` su questa macchina: usare Node e git.
- Gli input devono restare ≥ 16px (zoom di iOS).
