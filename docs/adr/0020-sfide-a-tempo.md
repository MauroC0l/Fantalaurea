# 0020 — Sfide a tempo

Data: 2026-09-25 · Stato: accettata

## Contesto

L'utente vuole sfide a tempo:
- le creano e le modificano l'admin o gli utenti abilitati (ADR 0018);
- possono essere più di una insieme;
- stanno in una sezione dentro "Azioni";
- ogni sfida dice se i punti vanno a tutti quelli che la completano in tempo o solo ai primi N;
- l'avviso arriva solo a chi ha l'app aperta;
- la funzione si può spegnere.

## Decisione

- **Tabelle** `challenges` (titolo, descrizione, punti 1–100, `winners_limit` nullo = tutti,
  inizio e fine) e `challenge_completions` (una per giocatore e sfida). Interruttore
  `challenges_enabled`.
- **Le sfide sono sempre bonus.** I punti entrano in `participants`: vale un completamento tra i
  primi `winners_limit` in ordine di arrivo, calcolato al volo. Se l'admin abbassa il limite
  dopo, chi è rimasto fuori perde i punti.
- **Completamento:** `complete_challenge` blocca la riga della sfida mentre conta, così "i primi
  N" sono davvero i primi N anche se due telefoni premono insieme. Risposte: `ended` (tempo
  scaduto) e `full` (posti finiti). Si può annullare solo mentre la sfida è in corso.
- **Gestione** (chi l'ha creata o l'admin): modifica; "prolunga", che fa ripartire il tempo da
  adesso e riapre anche una sfida finita; termina subito; elimina.
- **Avviso:** `ChallengesState` vive per tutta la sessione, non solo sulla schermata Azioni.
  Quando nella lista compare una sfida in corso mai vista, mostra un avviso con vibrazione,
  ovunque si trovi il giocatore. La scheda Azioni mostra quante sfide si possono ancora fare.
- **Interfaccia:**
  - `ChallengesSection` entra in cima ad Azioni (giocatore) e al pannello Azioni (admin),
    passata come segnaposto (`top`): le schermate delle azioni non dipendono dalle sfide;
  - l'admin crea e gestisce ma non partecipa.
- **Nessuna foto di prova in questa versione.**

## Motivazioni

- **Punti calcolati invece che salvati:** cambiare limite, punti o annullare non richiede di
  ricalcolare nulla.
- **Stato per tutta la sessione:** l'avviso ha senso proprio quando non sei sulla schermata
  delle sfide.
- **Niente foto:** l'utente non le ha chieste, e toccherebbero album, limite di 100, link firmati,
  reset e cancellazioni (YAGNI). Ne va chiesta conferma.

## Conseguenze negative

- **Niente notifiche push:** chi ha il telefono in tasca scopre la sfida solo quando apre l'app.
- **Il conto alla rovescia avanza ogni 5 secondi,** e sotto il minuto dice "meno di 1 min".
- **Una sfida senza foto si basa sulla fiducia,** come i malus.
- **La classifica calcola i punti delle sfide a ogni lettura:** con decine di sfide e 50
  persone va bene, oltre servirebbe salvarli.
- **Eliminare una sfida toglie i punti a chi l'aveva fatta.**

## Quando riaprirla

- Se servono le foto di prova, o malus a tempo.
- Se servono avvisi anche a telefono bloccato (push, con service worker e permessi).
