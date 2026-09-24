# ADR 0004 — Architettura a livelli nel frontend, con porte e un backend in memoria

Data: 2026-09-23 · Stato: accettata

## Contesto
Senza un server nostro (ADR 0002) tutta la logica applicativa vive nel frontend. L'account
Supabase non esiste ancora e la festa è il 2026-10-02: le schermate vanno sviluppate e
provate prima che il backend sia pronto.

## Decisione
- Livelli `domain/` → `application/` → `infrastructure/` + `ui/` + `features/` + `app/`,
  con le dipendenze che puntano verso il dominio (dettagli in `web/README.md`).
- `application/` definisce le porte (`PlayerAccounts`, `GameBoard`, `SessionStore`,
  `Haptics`); `infrastructure/` le implementa; `app/compose.ts` sceglie quali usare.
- Primo adapter: `MemoryBackend`, con dati nel browser, per sviluppo e prove.
- Le scritture dei contatori inviano il valore assoluto (`setCount(azione, 3)`) e sono
  serializzate per azione; l'interfaccia aggiorna subito il numero (ottimistico).

## Motivazioni
- Le schermate si costruiscono e si provano senza aspettare Supabase; poi si sostituisce solo
  l'adapter.
- Il dominio si testa con funzioni pure, gli use case con finti adapter.
- Valore assoluto + coda per azione: le richieste ripetute non contano doppio e i tocchi
  rapidi non arrivano al backend in ordine sbagliato.

Alternativa scartata: chiamare Supabase direttamente dalle schermate. È più veloce da
scrivere oggi, ma lega ogni schermata al fornitore e rende impossibile provarle senza backend.

## Conseguenze negative
- Più file e indirezione di quanto un'app così piccola richiederebbe da sola.
- Il backend in memoria può divergere dal comportamento reale di Supabase: le regole
  (nickname unico, contatori ≥ 0, bonus comune condiviso) vanno replicate nell'SQL e verificate
  anche lì.
- Due scritture concorrenti dallo stesso giocatore su due telefoni diversi: vince l'ultima.

## Quando riaprirla
Se servisse un server nostro, o se il valore assoluto causasse perdite di dati con lo stesso
giocatore attivo su più telefoni.
