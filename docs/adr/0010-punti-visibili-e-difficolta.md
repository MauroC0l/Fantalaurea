# ADR 0010 — Punti visibili, classifica a punti e difficoltà delle azioni

Data: 2026-09-25 · Stato: accettata (decisione dell'utente) · Supera "punti non mostrati"

## Contesto
Finora i punti erano salvati ma nascosti, e l'elenco partecipanti era ordinato per numero di
azioni. L'utente ora vuole i punti visibili, anche in classifica, e un'etichetta di
difficoltà per filtrare le azioni. Entrambi vanno scelti dall'admin quando crea o modifica
un'azione.

## Decisione
- Ogni azione mostra i suoi punti. La classifica ordina per punti totali, poi per numero di
  azioni, poi per nickname.
- Punti di un giocatore = somma dei punti delle azioni che ha completato + punti dei bonus
  comuni completati (valgono per tutti).
- L'admin inserisce i punti come numero positivo (0-1000). Il segno lo decide il tipo: un
  malus vale sempre in negativo. Così un malus non può valere punti positivi per errore.
- Nuovo campo `difficulty`: `soft` | `medium` | `hard` (predefinito `medium`), filtrabile
  nella lista delle azioni. Per le 27 azioni predefinite la difficoltà l'ha proposta Claude:
  l'utente la rivede dal pannello.

## Conseguenze negative
- La classifica spinge a giocare "per i punti": i malus pesano e qualcuno potrebbe non
  segnarli (il gioco resta sulla fiducia).
- Un bonus comune da 100 punti appiattisce la classifica: tutti ricevono gli stessi punti.
- La difficoltà di un malus è un concetto meno intuitivo ("quanto è grave").

## Quando riaprirla
Se la classifica creasse più tensione che divertimento.
