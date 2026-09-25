# ADR 0015 — Chat privata a due, con foto e messaggi vocali

Data: 2026-09-25 · Stato: accettata (i dettagli non indicati li ha scelti Claude, con
l'impostazione più prudente per la privacy)

## Contesto
L'utente vuole chattare: "Invia messaggio" dal profilo, una sezione Chat con le
conversazioni aperte, messaggi di testo, foto e vocali.

## Decisione
- Solo conversazioni **a due**. Una conversazione per coppia di giocatori (`player_a <
  player_b`), creata al primo messaggio.
- **Privata**: la leggono solo i due partecipanti. L'admin non la legge; le foto della chat
  non finiscono né in bacheca né nell'album.
- Messaggi: testo (fino a 1000 caratteri), foto (stessa compressione delle altre foto), vocali
  (fino a 60 secondi, registrati con MediaRecorder nel formato che il telefono sa
  riprodurre). Ognuno può eliminare i propri messaggi.
- File in un bucket privato `chat`; link firmati dati dalla funzione `photos` solo ai due
  partecipanti.
- Non letti: per ogni conversazione si salva quando ciascuno l'ha letta l'ultima volta.
- Tempo reale: ogni giocatore ha una `inbox_key` casuale e segreta e ascolta il canale
  `inbox:<chiave>`. Chi invia riceve dal server la chiave del destinatario e lo avvisa lì. Il
  segnale non contiene il messaggio, e chi guarda il canale pubblico non scopre chi scrive a
  chi.
- La chat segue l'interruttore `chat_enabled` (ADR 0014) e si cancella con "Termina e
  ricomincia".

## Conseguenze negative
- Senza moderazione: se qualcuno manda contenuti molesti, l'admin non può vederli né
  rimuoverli. Rimedi possibili: bloccare utenti, segnalazioni, o spegnere la chat.
- I vocali registrati su Android (WebM/Opus) potrebbero non suonare su iPhone vecchi (prima di
  iOS 17.4). Si registra in MP4/AAC dove il browser lo permette.
- Un segnale perso (telefono offline) fa arrivare il messaggio al prossimo aggiornamento, non
  subito.

## Quando riaprirla
Se servissero gruppi, moderazione della chat o la conservazione delle conversazioni tra una
festa e l'altra.
