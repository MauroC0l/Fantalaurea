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

## Produzione (2026-09-24)
- Progetto Supabase `bakucjmeuswvkaiyaiud` (Frankfurt), collegato con `supabase link`
  (l'utente ha fatto login e link; Claude può lanciare `npx supabase db push --workdir ..`
  da `web/`).
- Schema + seed caricati e verificati via API: 27 azioni, RLS ok, database svuotato dopo
  la prova.
- `web/.env.production` versionato con URL e chiave publishable.
- GitHub Pages abilitato dall'utente. URL: https://mauroc0l.github.io/Fantalaurea/ (username con lo ZERO)
- Verificato in produzione (2026-09-24): 3 browser separati, tempo reale ok; dati di prova
  eliminati (27 azioni, 0 partecipanti).

## Prossimi passi
- Prova con telefoni veri (iPhone + Android, più persone insieme) entro il 2026-09-30.
- Prima di ogni festa: controllare che il progetto Supabase non sia in pausa.
- Docker serve solo per lo stack locale: chiudibile, non serve alla produzione.
- Nuove modifiche al DB: nuova migrazione in `supabase/migrations/` + `db push`.

## Trappole
- Supabase gratuito va in pausa dopo 7 giorni senza traffico: riattivarlo prima di ogni festa.
- Il workflow di deploy fallisce finché GitHub Pages non è abilitato.
- Lo stack locale richiede Docker Desktop acceso (`npm run db:start` da `web/`).
- Se si cambia `default-catalog.ts`, rigenerare `seed.sql` con `npm run db:seed`.
- Niente Python e niente `gh` su questa macchina: usare Node e git.
- Gli input devono restare ≥ 16px (zoom di iOS).
