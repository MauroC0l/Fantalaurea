# features

Le schermate e lo stato di gioco lato interfaccia.

## Contenuto
- `rules/RulesScreen`: regole. Con `onjoin` è il benvenuto del primo accesso (con il pulsante
  "Partecipa"); senza, è la pagina "Regole" della tab bar.
- `join/JoinScreen`: iscrizione o rientro (stesso nickname + stesso nome = rientro).
- `actions/ActionsScreen` + `ActionCard`: elenco delle azioni con filtro Tutte/Bonus/Malus,
  contatori, vibrazione, uscita con conferma (il token si dimentica, i dati restano).
- `participants/ParticipantsScreen`: partecipanti ordinati per azioni fatte, aggiornati in
  tempo reale.
- `admin/AdminScreen` + `AddActionDialog` + `admin-state.svelte.ts`: pannello admin (aggiunta
  ed eliminazione di azioni con conferma, azzeramento della serata, uscita).
- `game/game-state.svelte.ts`: `GameState`, lo stato reattivo di una partita:
  - l'aggiornamento è ottimistico (il numero cambia subito);
  - le scritture sono in coda per azione (tocchi rapidi non arrivano in ordine sbagliato);
  - se una scrittura fallisce si riallinea ai dati del backend;
  - si risincronizza a ogni notifica `onChange` (anche il catalogo, se l'admin lo cambia);
  - se il giocatore sparisce (serata azzerata) chiama `onSessionLost`.

## Relazioni
- Dipende da: `application/` (use case e porte: `GameBoard`, `EveningAdmin`), `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`.
- Dati posseduti: stato in memoria della partita (`GameState`) o del pannello (`AdminState`).
