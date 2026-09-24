# ADR 0007 — Ogni azione si completa una volta sola

Data: 2026-09-24 · Stato: accettata (decisione dell'utente) · Supera la parte "contatori"
degli ADR 0004 e 0005

## Contesto
All'inizio ogni azione si poteva spuntare più volte (contatori). L'utente ha cambiato le
regole: ogni azione si fa una volta; quando è fatta esce da Bonus/Malus ed entra in
"Completate".

## Decisione
- I contatori (`player_counts`, `shared_counts`) sono sostituiti dai completamenti
  (`player_completions`, `shared_completions`): una riga = azione fatta, con l'ora e
  l'eventuale foto.
- Un completamento si può annullare dalla lista "Completate". Il bonus comune lo può
  annullare solo chi l'ha segnato.
- Il numero di azioni di un giocatore = i suoi completamenti + i bonus comuni completati.

## Motivazioni
Il nuovo modello rende irrappresentabile uno stato non valido (un'azione fatta "3 volte")
anche nel database, grazie alla chiave primaria (giocatore, azione).

## Conseguenze negative
- Il malus "Clash Royale, chi perde prende doppio malus" non si può più rappresentare.
- Spariscono contatore, coriandoli sul + e la coda di scritture di ADR 0004 (non più
  necessaria).
- Passare un'azione da/a "per tutti" quando è già stata completata non è permesso: cambierebbe
  tabella di appartenenza.

## Quando riaprirla
Se si volessero di nuovo azioni ripetibili.
