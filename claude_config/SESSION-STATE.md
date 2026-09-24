# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-23

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente: ci si reiscrive e alla fine i dati si possono buttare. L'app si usa quasi solo
da telefono. I giocatori si iscrivono con nickname + nome reale, segnano (anche più volte)
le azioni bonus/malus compiute e vedono i partecipanti con il numero di azioni fatte. Le
regole compaiono al primo accesso e restano rileggibili da una tab. Grafica a tema festa,
solo scura, 100% personalizzata. Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`.
- ADR 0001: SPA in Svelte 5 + TypeScript + Vite, routing via hash.
- ADR 0002: backend Supabase gratuito (Postgres + RPC + Realtime), nessun server nostro.
- ADR 0003: identità = nickname + nome reale, senza password; la stessa coppia fa rientrare.
- ADR 0004: architettura a livelli con porte; `MemoryBackend` per sviluppare senza Supabase;
  scritture a valore assoluto, serializzate per azione.
- Punti salvati ma non mostrati. Il bonus comune, segnato da chiunque, vale per tutti.
  Malus sulla fiducia. L'azione "foto intima" resta: rischio segnalato, confermata
  dall'utente.
- Ogni serata ha la sua lista di azioni. Il primo iscritto è admin: può modificare la lista
  e nominare altri admin. Interfaccia admin da fare PIÙ AVANTI (parole dell'utente:
  "penseremo poi").
- Vibrazione sì (su iOS non funziona). Nessuna PWA.

## Stato attuale (verificato 2026-09-23)
- `web/` funziona in locale con il backend in memoria. Schermate: regole/benvenuto,
  iscrizione (validazione, nickname preso, rientro), azioni (filtro, contatori, coriandoli,
  vibrazione), partecipanti (ordinati, animati, "Tu"), tab bar.
- `npm test`: 21 test verdi. `npm run check`: 0 errori. `npm run build`: circa 32 kB gzip.
- Verificata in Chrome headless a 390×844 con Playwright; lo script era nello scratchpad,
  non nel repo.
- Nessun commit. Remote: https://github.com/MauroC0l/Fantalaurea.git.

## Domande aperte (in attesa dell'utente)
1. Come nasce una nuova serata e come ci si arriva: serata attiva unica oppure link per
   serata?
2. Admin per il 2 ottobre: solo il flag nel database, senza interfaccia?
3. Il "numero di azioni" conta anche malus e bonus comune? Oggi sì.
4. Repo pubblico (GitHub Pages) o privato (Cloudflare Pages)?
5. Commit del lavoro fatto?

## Prossimi passi
Risposte → schema Supabase (migrazioni SQL, RLS, RPC, seed generato da `default-catalog.ts`)
→ adapter Supabase → deploy → prova con più telefoni veri entro il 2026-09-30.

## Trappole
- Supabase gratuito mette in pausa il progetto dopo 7 giorni senza traffico.
- La anon key è pubblica: scritture solo tramite RPC validate; i token in una tabella non
  leggibile.
- Il `MemoryBackend` non condivide dati tra dispositivi: non è utilizzabile alla festa.
- Su Windows non c'è Python: per gli script usare Node.
- Gli input devono restare ≥ 16px, altrimenti iOS zooma al focus.
