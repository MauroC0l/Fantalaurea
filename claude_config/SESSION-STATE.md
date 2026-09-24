# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-24

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente: ci si reiscrive e alla fine i dati si buttano. L'app si usa quasi solo da
telefono. I giocatori si iscrivono con nickname + nome reale, segnano (anche più volte) le
azioni bonus/malus compiute e vedono i partecipanti con il numero di azioni fatte. Le regole
compaiono al primo accesso e restano rileggibili da una tab. Un admin gestisce la lista
delle azioni e la serata. Grafica a tema festa, solo scura, 100% personalizzata.
Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`. L'utente autorizza commit liberi (2026-09-24). Push: da
  confermare.
- ADR 0001: SPA in Svelte 5 + TypeScript + Vite, routing via hash.
- ADR 0002: backend Supabase gratuito (Postgres + RPC + Realtime), nessun server nostro.
- ADR 0003: identità = nickname + nome reale, senza password; la stessa coppia fa rientrare.
- ADR 0004: architettura a livelli con porte; `MemoryBackend` per sviluppare; scritture a
  valore assoluto, serializzate per azione.
- ADR 0005: admin con credenziali fisse `Administrator` / `admin` (nickname riservato; non
  è un giocatore). Una sola serata attiva; "Termina e ricomincia" cancella giocatori e
  conteggi e mantiene la lista.
- Il numero di azioni conta tutto: bonus, malus e bonus comune (confermato dall'utente).
- Punti salvati ma non mostrati; le azioni aggiunte dall'admin valgono 0 punti.
- Vibrazione sì (su iOS non funziona). Nessuna PWA.

## Stato attuale (verificato 2026-09-24)
- Commit `2c9fb52` con la prima versione. Il lavoro sull'admin è nel commit successivo.
- Funziona in locale con `MemoryBackend`:
  - regole, iscrizione, azioni, partecipanti;
  - pannello admin: aggiunta con validazione, eliminazione con conferma, azzeramento con
    conferma, uscita.
- 29 test verdi, `npm run check` pulito, build di circa 35 kB gzip.
- Flussi admin verificati in Chrome headless 390×844; lo script Playwright è nello
  scratchpad, non nel repo.
- Repo GitHub `MauroC0l/Fantalaurea`: PUBBLICO (API 200) e ancora vuoto, nessun push.

## Domande aperte
1. Credenziali admin in un repo pubblico: le teniamo così o le cambiamo con il backend
   reale?
2. Push su GitHub: si può fare?
3. Account Supabase: l'utente lo crea "quando arriverà il momento", che è adesso.

## Prossimi passi
Schema Supabase (migrazioni SQL: tabelle, RLS, RPC `join`/`set_count`/admin, credenziali
admin fuori dal repo, seed generato da `default-catalog.ts`) → adapter Supabase → deploy
su GitHub Pages con GitHub Actions → prova con più telefoni veri entro il 2026-09-30.

## Trappole
- Supabase gratuito mette in pausa il progetto dopo 7 giorni senza traffico.
- La anon key è pubblica: scritture solo tramite RPC validate; token e credenziali admin in
  tabelle non leggibili.
- Il `MemoryBackend` non condivide dati tra dispositivi: alla festa non si può usare.
- Su Windows non c'è Python: per gli script usare Node. `gh` non è installato.
- Gli input devono restare ≥ 16px, altrimenti iOS zooma al focus.
