# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-25

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente: ci si reiscrive e alla fine i dati si buttano. Si usa quasi solo da telefono.
- I giocatori completano le azioni della serata, ognuna una sola volta, alcune con foto.
- Vedono i partecipanti con il numero di azioni fatte.
- Un admin gestisce la lista delle azioni, l'album delle foto e la chiusura della serata.

Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`. Commit e push autorizzati liberamente.
- 0001 Svelte + TS SPA, routing via hash.
- 0002 Supabase: scritture solo via RPC / funzione.
- 0003 identità nickname + nome reale.
- 0004 livelli + porte.
- 0005 admin `Administrator` / `admin`, serata unica.
- 0006 credenziali admin pubbliche: accettato dall'utente.
- 0007 ogni azione una volta sola: completamenti al posto dei contatori; si può annullare;
  il bonus comune lo annulla solo chi l'ha segnato.
- 0008 foto: bucket privato + Edge Function `photos`; JPEG 2560 px / qualità 0,9 +
  miniatura 480 px; politica per azione `none` / `optional` / `required`.
- 0009 eliminato `MemoryBackend`: si sviluppa sul Supabase locale (Docker).
- 0010 punti visibili (classifica per punti) e difficoltà soft/medium/hard. FATTO e in
  produzione il 2026-09-25. Le difficoltà delle 27 azioni le ha proposte Claude:
  l'utente le rivede.
- L'azione "Il gioiello di famiglia" (foto intima) ha la foto FACOLTATIVA: rischio legale
  (art. 612-ter) segnalato due volte, confermato dall'utente.
- Politiche foto scelte dall'utente:
  - obbligatoria: petto nudo, verticale, selfie da paparazzo, scarpe, autografo, selfie con
    il pelato, lento, tesi al passante;
  - nessuna: cavallo e le altre.
- Titoli delle azioni scritti da Claude: l'utente deve rivederli (si cambiano dal pannello).
- Cancellare una foto obbligatoria annulla l'azione (con avviso); cancellare una foto
  facoltativa lascia l'azione fatta.

## Stato attuale (verificato 2026-09-24)
- Produzione: https://mauroc0l.github.io/Fantalaurea/ (username con lo ZERO). Commit
  `2554965` pushato.
- Supabase `bakucjmeuswvkaiyaiud`: 3 migrazioni applicate, 27 azioni, funzione `photos`
  pubblicata.
- La lista predefinita è la migrazione `20260924130000_default_catalog.sql`: il seed non
  veniva rieseguito in produzione, quindi è stato eliminato.
- Test verdi:
  - 19 unitari;
  - 9 d'integrazione (`npm run test:db`, che ricrea il DB locale);
  - prova completa nel browser sul locale: foto obbligatoria, anteprima, invio, Fatte,
    elimina foto → annulla, modifica azione dall'admin vista in tempo reale dal giocatore,
    album, ZIP, visore, promemoria prima di azzerare.

## In attesa di decisioni (richiesta del 2026-09-25, punti 1-5)
L'utente ha chiesto:
1. sovrascrivere il profilo se il nome reale esiste già;
2. pagina profilo dalla classifica;
3. foto profilo e bio di 500 caratteri;
4. parola segreta per entrare nella serata, generata e modificabile dall'admin;
5. bacheca stile Instagram con post e schede delle azioni.

Claude ha segnalato due problemi bloccanti:
- la parola segreta non protegge nulla se i dati restano leggibili senza token e se le
  credenziali admin sono pubbliche nel repo;
- in bacheca le foto intime ("Il gioiello di famiglia") verrebbero distribuite a tutti.

Domande inviate in chat; nessun codice scritto per 1-5.

## Prossimi passi
- L'utente rivede i titoli e prova con telefoni veri (iPhone + Android) entro il 2026-09-30,
  soprattutto la fotocamera e "Condividi" su iPhone.
- Prima di ogni festa: controllare che Supabase non sia in pausa.

## Trappole
- Vite: `.env.production` vince su `.env.local`. Il file locale si chiama
  `web/.env.development.local`. Per provare una build sul locale usare
  `npx vite build --mode development`.
- La CLI Supabase non riesegue un seed già applicato: i dati necessari in produzione vanno in
  una migrazione.
- Cancellare righe dalla dashboard lascia file orfani nel bucket `photos`.
- Docker serve solo per sviluppare (stack locale), non per l'app online.
- Niente Python e niente `gh` su questa macchina; PowerShell blocca `npx` (usare `npx.cmd` o
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- Input ≥ 16px (zoom di iOS). iOS non vibra.
