# features

Le schermate e il loro stato.

## Giocatore
- `rules/RulesScreen`: regole. Con `onjoin` è il benvenuto del primo accesso; senza, è la tab
  "Regole".
- `join/JoinScreen`: iscrizione, rientro o accesso admin.
- `actions/ActionsScreen`: punti del giocatore, barra di avanzamento, filtro Tutte / Bonus /
  Malus / Fatte e filtro per difficoltà, uscita.
  Coordina le finestre di conferma (foto, annulla, elimina foto, esci) e il visore.
  - `ActionItem`: azione chiusa (titolo) che si apre in una tendina con descrizione e
    pulsanti "Fatta!" / "Fatta, con foto" / "Scatta la foto e completa".
  - `CompletedItem`: azione fatta, con ora, miniatura della propria foto, "Annulla",
    "Elimina foto", "Aggiungi foto".
  - `PhotoConfirmDialog`: anteprima della foto prima dell'invio.
- `participants/ParticipantsScreen`: classifica per punti, con il numero di azioni.
- `game/game-state.svelte.ts`: `GameState`, lo stato della serata del giocatore (`todo`,
  `done`, foto proprie, operazioni in corso per azione). Si risincronizza a ogni `onChange`;
  chiede i link delle foto solo quando cambiano o stanno per scadere. Se il giocatore non
  esiste più chiama `onSessionLost`.

## Admin
- `admin/AdminActionsScreen` + `ActionEditorDialog`: lista azioni, crea / modifica (titolo,
  descrizione, tipo, punti, difficoltà, politica foto), elimina, "Termina e ricomincia" con promemoria delle
  foto se l'album non è vuoto.
- `admin/AlbumScreen` + `album-state.svelte.ts`: griglia di miniature, visore con
  condividi / scarica / elimina, "Prepara" → condividi tutte o ZIP.
- `admin/admin-state.svelte.ts`: catalogo e numero di partecipanti in tempo reale.

## Condivisi
- `labels.ts`: etichette di tipo, difficoltà (e livello 1-3) e politica foto, formato dell'ora.

## Relazioni
- Dipende da: `application/`, `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`.
- Dati posseduti: stato in memoria di partita, pannello e album.
