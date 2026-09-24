# ADR 0003 — Identità: nickname + nome reale, senza password

Data: 2026-09-23 · Stato: accettata (decisione dell'utente)

## Contesto
Gli invitati si iscrivono al volo durante una festa tra amici. Serve poter rientrare se si
cambia telefono o si svuota il browser, senza attrito.

## Decisione
- Il nickname è unico in tutta l'app (senza distinguere maiuscole/minuscole né spazi ai bordi).
- Iscrizione e rientro sono la stessa operazione:
  - nickname libero → nuovo giocatore;
  - nickname esistente + stesso nome reale → rientro nel profilo esistente;
  - nickname esistente + nome reale diverso → errore "nickname già in uso".
- Dopo l'accesso il server restituisce un token casuale, salvato nel browser e usato per
  ogni scrittura. Il token non è mai leggibile da altri client.

## Motivazioni
Zero attrito (nessuna password da ricordare), recupero garantito. Il contesto è di fiducia
reciproca: il gioco stesso si basa sull'onestà dei giocatori.

## Conseguenze negative
- Chi conosce nickname e nome reale di qualcuno può entrare nel suo profilo e modificarne i
  contatori. Accettato consapevolmente.
- Il nome reale funziona da "segreto" pur essendo visibile a tutti nell'elenco partecipanti.

## Quando riaprirla
Se l'app venisse usata fuori dal gruppo di amici, o se comparissero abusi.
