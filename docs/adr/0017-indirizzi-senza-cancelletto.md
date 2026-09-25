# 0017 — Indirizzi senza cancelletto

Data: 2026-09-25 · Stato: accettata · Supera: la parte "routing via hash" dell'ADR 0001

## Contesto

Fino a oggi gli indirizzi erano `…/Fantalaurea/#/bacheca`: l'hash funziona su qualunque hosting
statico senza configurazione (ADR 0001). L'utente vuole indirizzi puliti: `…/Fantalaurea/bacheca`.
GitHub Pages non ha regole di riscrittura: per un percorso che non esiste come file risponde con
`404.html`.

## Decisione

- **Router sulla History API** (`app/router.svelte.ts`, `PathRouter`):
  - i link interni restano normali `<a href>`, e un clic su uno di essi diventa una navigazione
    senza ricaricare la pagina;
  - `go(route, { replace })` per i reindirizzamenti, `back(fallback)` per i pulsanti
    "indietro";
  - ogni voce della cronologia ricorda il punto di scorrimento, così "indietro" riporta dov'eri.
- **Build con base assoluta** (`BASE_PATH`, `/Fantalaurea/` nel deploy) e copia di `index.html`
  in `404.html` (plugin `spaFallback` in `vite.config.ts`): Pages risponde a
  `/Fantalaurea/classifica` con l'app, che parte a quel percorso.
- **I vecchi link con `#/…` vengono convertiti all'avvio**, quindi i link già condivisi
  funzionano ancora.

## Motivazioni

- **Copiare `index.html` in `404.html` è l'opzione più semplice.** Il trucco alternativo (una
  `404.html` che reindirizza a `index.html?p=…` e poi ricostruisce l'indirizzo) aggiunge un
  passaggio visibile e più codice.
- **Il ricordo del punto di scorrimento** risolve un limite segnalato prima, a costo zero: la
  History API ha già uno stato per ogni voce.

## Conseguenze negative

- **Aprire direttamente un indirizzo interno risponde con codice HTTP 404.** La pagina si vede
  normalmente, ma i motori di ricerca e gli strumenti di anteprima dei link lo considerano un
  errore. Per un'app privata di una festa non conta.
- **La build dipende da dove è pubblicata** (`BASE_PATH`). Spostare l'hosting o usare un dominio
  proprio richiede di cambiare questa variabile.
- **Il router intercetta i clic su tutti i link interni.** Un link che deve davvero ricaricare la
  pagina va marcato con `target` o `download`.

## Quando riaprirla

- Se si passa a un hosting con riscritture vere (Cloudflare Pages, Netlify, Vercel). La
  `404.html` diventa inutile e il codice 404 sparisce.
- Se si aggiunge un dominio proprio: `BASE_PATH` diventa `/`.
