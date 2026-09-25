# 0019 — Sondaggi

Data: 2026-09-25 · Stato: accettata

## Contesto

L'utente vuole una sezione "Sondaggi" attivabile dall'admin. Regole decise il 2026-09-25:
- li creano l'admin o gli utenti che l'admin abilita (ADR 0018);
- ogni sondaggio ha le sue impostazioni: anonimo o no, una o più scelte, quando si vedono i
  risultati, se si può cambiare voto, come si chiude ("automatica o temporizzata");
- niente punti.

## Decisione

- **Tabelle** `polls` (domanda e regole), `poll_options` (2–10) e `poll_votes` (una riga per
  opzione scelta). Interruttore `polls_enabled`.
- **Risultati:** `always`, `after-vote` o `after-close`, calcolati dal server in `polls(token)`.
  - Finché le regole li nascondono, conteggi e nomi non escono dal database: il telefono non
    li riceve proprio.
  - L'admin vede sempre i conteggi, mai i nomi di un sondaggio anonimo.
- **Chiusura:**
  - a mano da chi l'ha creato o dall'admin;
  - oppure a tempo, con una durata scelta tra 5, 15 e 30 minuti, 1 e 2 ore;
  - oppure "quando hanno votato tutti": la chiusura viene scritta al momento dell'ultimo voto,
    così chi entra dopo non riapre il sondaggio.
- **L'admin crea e gestisce ma non vota:** i voti sono dei giocatori.
- **I voti dei bloccati non contano,** e i sondaggi creati da loro non si vedono (ADR 0018).
- **Il reset cancella anche i sondaggi dell'admin,** che non hanno un giocatore da cui sparire a
  cascata.
- **Interfaccia:**
  - scheda "Sondaggi" per giocatori e admin;
  - si sceglie e poi si preme "Vota", invece del voto al primo tocco: con "non si può cambiare
    voto" un tocco sbagliato sarebbe definitivo;
  - componenti nuovi del sistema di stili: `ResultBar`, `AvatarStack`, `ChipGroup`;
  - con 6 schede la barra mostra solo le icone.

## Motivazioni

- **Visibilità decisa dal server:** nascondere i risultati solo nell'interfaccia sarebbe finto,
  perché chiunque potrebbe leggerli dalla rete.
- **Durate predefinite invece di data e ora:** a una festa servono "tra 15 minuti", non "alle
  23:47", e ci si risparmia un calendario personalizzato da costruire.
- **"Automatica" come "quando hanno votato tutti":** è l'interpretazione più utile. È segnata
  come domanda aperta per l'utente.

## Conseguenze negative

- **Un sondaggio a tempo non si chiude da solo nel database:** risulta chiuso perché
  `closes_at` è passato. Tutte le funzioni lo controllano, ma chi legge le tabelle a mano deve
  saperlo.
- **"Quando hanno votato tutti" conta i giocatori presenti al momento del voto.** Se entra
  qualcuno prima dell'ultimo voto, serve anche il suo.
- **La lista si rilegge per intero a ogni voto di chiunque.** Con 50 persone e pochi sondaggi
  va bene; con centinaia di sondaggi servirebbe la paginazione.
- **Solo icone nella barra a 6 schede:** meno immediate per chi non conosce l'app.

## Quando riaprirla

- Se i sondaggi devono dare punti o legarsi alle azioni.
- Se serve una data e un'ora di chiusura precise.
- Se "automatica" per l'utente significa altro.
