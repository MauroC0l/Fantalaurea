# ADR 0014 — Funzioni attivabili dall'admin, serata per serata

Data: 2026-09-25 · Stato: accettata

## Contesto
L'utente vuole che l'admin possa accendere o spegnere alcune funzioni in base alla festa (per
esempio la chat).

## Decisione
- Interruttori salvati come colonne booleane in `evening_settings`: `chat_enabled`,
  `feed_enabled`, `leaderboard_enabled`. Tutte accese di base.
- Colonne tipizzate e non un JSON libero: ogni funzione è nota al database, e un nome
  sbagliato è un errore invece di una chiave ignorata. Aggiungere una funzione richiede una
  migrazione, ed è voluto.
- Il server rispetta gli interruttori: con la chat spenta non si inviano messaggi; con la
  bacheca spenta non si pubblicano post. L'app nasconde le schede spente e, se ci si trova
  sopra, porta alle Azioni.
- La classifica spenta nasconde la scheda e la posizione nei profili; i punti restano, perché
  sono parte del gioco.
- Gli interruttori sopravvivono a "Termina e ricomincia": sono una preferenza
  dell'organizzatore, non un dato della festa.

## Conseguenze negative
- Spegnere la bacheca non cancella i post: tornano visibili riaccendendola.
- Chi ha l'app aperta vede il cambiamento al segnale successivo (qualche istante).

## Quando riaprirla
Se le funzioni attivabili diventassero molte (a quel punto: una tabella `features`).
