# ADR 0012 — Bacheca, profili e foto visibili a tutti i partecipanti

Data: 2026-09-25 · Stato: accettata (decisione dell'utente) · Supera la regola "foto solo
all'autore e all'admin" dell'ADR 0008

## Contesto
L'utente vuole un piccolo social interno: una bacheca in stile Instagram con i post dei
giocatori e le schede delle azioni completate, like con l'elenco di chi li ha messi, e
profili con foto e bio. La parola segreta (ADR 0011) limita il pubblico ai partecipanti.

## Decisione
- Tutte le foto (azioni, post, foto profilo) sono visibili a tutti i partecipanti della
  serata. Il bucket resta privato: i link firmati li dà la funzione `photos` a chi ha un
  token valido, con durata di 12 ore e una cache sul telefono.
- **Bacheca**: post (foto obbligatoria + didascalia fino a 300 caratteri) e schede
  automatiche per ogni azione completata, malus compresi. Annullare l'azione toglie la
  scheda. Niente commenti.
- **Like** su post e schede, con l'elenco di chi li ha messi. Chi ha pubblicato cancella il
  suo post; l'admin modera dall'album (eliminare la foto di un post elimina il post).
- **Profilo**: foto quadrata (ritagliata al centro, 512 px), bio fino a 500 caratteri,
  punti, posizione, azioni completate e griglia di foto. Si apre dalla classifica e dalla
  bacheca.
- Navigazione del giocatore: Bacheca · Azioni · Classifica · Profilo. Le regole si aprono
  dal profilo e al primo accesso.
- L'azione con la foto intima ("Il gioiello di famiglia") è eliminata: una bacheca la
  distribuirebbe a tutti i partecipanti (art. 612-ter c.p.).

## Conseguenze negative
- Le foto non sono più private: chi completa un'azione con foto la mostra a tutti. I testi
  dell'app lo dicono chiaramente.
- Più letture e più link firmati: più chiamate alla funzione (dentro i limiti gratuiti per
  50 persone).
- La moderazione è manuale e solo a posteriori.

## Quando riaprirla
Se servissero commenti, notifiche, foto private per singola azione, o una moderazione
preventiva.
