# Stato della sessione — Fantalaurea

Ultimo aggiornamento: 2026-09-25 (notte)

## Obiettivo
Web app "Fantalaurea" per le feste di laurea di un gruppo di circa 50 amici. Ogni festa è
indipendente: a fine serata si azzera tutto. È un gioco a punti con azioni da completare, più un
piccolo social interno: bacheca, chat, sondaggi, sfide a tempo. Si entra con una parola
segreta. Si usa quasi solo da telefono. Prima festa: **2026-10-02**.

## Decisioni prese (dettagli in docs/adr/)
- Regole di lavoro: `CLAUDE.md`. Commit e push autorizzati liberamente.
- 0001 Svelte + TS SPA (il routing via hash è superato da 0017) · 0002 Supabase · 0003 identità
  nickname + nome vero · 0004 livelli e porte.
- 0005 / 0006: admin `Administrator` / `admin`, credenziali pubbliche nel repo, confermate
  dall'utente. Contromisura: log degli accessi admin.
- 0007 ogni azione una volta sola, annullabile · 0008 foto in bucket privato + Edge Function ·
  0009 niente backend in memoria · 0010 punti visibili e difficoltà.
- 0011 serata chiusa, parola segreta, nessuna tabella leggibile dai client · 0012 bacheca e
  profili · 0013 segnali di tempo reale dai client (classe `ChangeSignals`, un solo canale).
- 0014 funzioni attivabili per serata: Azioni, Bacheca, Chat, Classifica, Sondaggi, Sfide.
- 0015 chat privata · 0016 chat come WhatsApp:
  - rispondi, modifica, inoltra, elimina per me o per tutti;
  - svuota, cancella, segna da leggere;
  - "sta scrivendo".
- 0017 indirizzi senza `#`: History API e copia di `index.html` in `404.html`.
- 0018 Utenti:
  - blocco reversibile, rientro rifiutato anche con lo stesso nome vero;
  - permessi per sondaggi e sfide;
  - limite di 100 foto esistenti per utente.
- 0019 sondaggi con regole per sondaggio · 0020 sfide a tempo, punti a tutti o ai primi N,
  senza foto per ora.
- Azione "foto ai genitali" eliminata (decisione dell'utente, rischio art. 612-ter).

## Stato attuale (verificato 2026-09-25 notte)
- Tutto in produzione e verificato sul sito vero (commit 5d70606, 2026-09-25 notte), compreso il
  giro successivo (ADR 0021): regole riscritte dall'utente, filtro "A tempo" nelle Azioni, sfide in
  Fatte / profilo / bacheca, bacheca Post e Imprese, durata personalizzata, download guidato.
- Nella festa ci sono 4 sondaggi e 3 sfide dimostrativi; `Il Demo` può creare sondaggi e sfide.
- Test: 45 unitari, 34 d'integrazione (`npm run test:db`), tutti verdi.
- **La festa di produzione è piena di dati finti** (richiesta dell'utente):
  - 126 giocatori, 1316 completamenti (458 con foto), circa 90 post, 2775 like, circa 75 chat;
  - parola: `spritz-relatore-77`;
  - account demo: nickname `Il Demo`, nome vero `Demo Fantalaurea`;
  - **da azzerare con "Termina e ricomincia" prima del 2026-10-02**;
  - le 10 azioni aggiunte dallo script (es. "Discorso di ringraziamento infinito")
    sopravvivono al reset: vanno tolte a mano dal pannello Azioni.

## Domande aperte per l'utente
- **Dominio proprio** al posto di `mauroc0l.github.io/Fantalaurea`. Opzioni:
  - dominio comprato (circa 10 €/anno) su GitHub Pages;
  - sottodominio gratis su Cloudflare Pages / Netlify, che hanno anche le riscritture e
    quindi eliminerebbero il codice 404.
- **Sfide con foto di prova?** Oggi no: aggiungerle tocca album, limite, link e reset.
- Nella lista di chi ha fatto una sfida, i bloccati occupano ancora il loro posto (si vedono buchi
  tipo 1°, 3°): va deciso se ricalcolare le posizioni escludendoli.

## Prossimi passi
- L'utente prova tutto coi dati finti, poi azzera la serata e toglie le azioni demo.
- Prove su telefoni veri entro il 2026-09-30: fotocamera (Xiaomi!), vocali iPhone, pressione
  lunga, trascina per rispondere.
- Dal 2026-09-30 solo correzioni. Prima di ogni festa: Supabase non in pausa.

## Trappole
- Vite:
  - `.env.production` vince su `.env.local`, per questo il file locale è
    `web/.env.development.local`;
  - build di prova sul locale: `npx vite build --mode development`;
  - con `BASE_PATH` in Git Bash serve `MSYS_NO_PATHCONV=1`, altrimenti `/Fantalaurea/` diventa un
    percorso di Windows.
- Per provare in locale come su GitHub Pages: server `pages-server.mjs` (scratchpad), porta
  4180, sotto `/Fantalaurea/` con fallback su `404.html`.
- La CLI Supabase non riesegue un seed già applicato: i dati per la produzione vanno in una
  migrazione.
- SQL:
  - Supabase blocca `UPDATE` / `DELETE` senza `WHERE` (usare `where true`);
  - una funzione `stable` nella stessa istruzione di un `insert` non vede la riga nuova;
  - ogni migrazione che aggiunge funzioni ripete `revoke ... grant` con l'elenco completo delle
    RPC client (vedi l'ultima migrazione).
- Le letture con token scaduto rispondono HTTP 403 (codice `28000`): è il segnale atteso.
- Griglie CSS: senza `grid-template-columns: minmax(0, 1fr)` un testo con ellipsis allarga la
  pagina.
- Storage: niente centinaia di file in una richiesta sola. Le RPC restituiscono al massimo
  1000 righe.
- Negli script bash niente apostrofi dentro `node -e` o heredoc complessi: scrivere script `.cjs`
  su file.
- Docker serve solo per sviluppare. Niente Python né `gh` su questa macchina.
