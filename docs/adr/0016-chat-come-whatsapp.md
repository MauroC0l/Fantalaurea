# 0016 — Chat come WhatsApp: rispondi, modifica, inoltra, elimina, "sta scrivendo"

Data: 2026-09-25 · Stato: accettata · Estende: 0015

## Contesto

L'utente vuole la chat "come WhatsApp":
- tenendo premuto un messaggio si apre un menu: rispondi, modifica, inoltra, elimina per me / per tutti;
- dalla lista, tenendo premuta una chat: segna come da leggere, svuota, cancella;
- i tre puntini quando l'altra persona sta scrivendo.

Regole scelte con l'utente il 2026-09-25:
- nessun limite di tempo per modificare o eliminare per tutti;
- inoltro fino a 5 chat, con l'etichetta "Inoltrato";
- "svuota" e "cancella chat" valgono solo per chi li chiede.

Nello stesso giro è emerso un bug: il fumetto era un `<button>`, disattivato per i messaggi
ricevuti, e bloccava il play dei vocali che conteneva.

## Decisione

- **Elimina per tutti = cancellazione morbida.** La riga resta con `deleted_at` e senza testo né
  file (il file lo toglie la Edge Function). Gli altri vedono "Messaggio eliminato" e le
  risposte che la citano non si rompono.
- **Elimina per me = tabella `message_hidden`** (messaggio, giocatore).
- **Per persona, sulla conversazione** (lato a/b):
  - `cleared_at`: i messaggi fino a quell'istante non si vedono più (svuota);
  - `removed`: la chat esce dall'elenco finché non arriva un messaggio nuovo (cancella chat);
  - `marked`: "da leggere", conta come un non letto.
- **Risposta:** `reply_to` (stessa conversazione, verificato dal server). **Modifica:**
  `edited_at`, solo testi propri. **Inoltro:** l'Edge Function crea copie con file nuovi (copiati
  nello storage). Condividere lo stesso file tra più chat renderebbe la cancellazione di una
  copia pericolosa per le altre.
- **"Sta scrivendo" è solo un segnale** sul canale personale del destinatario (evento `typing`),
  inviato al massimo ogni 2,5 s e mostrato per 5 s. Niente nel database.
- **Interfaccia:**
  - il fumetto non è più un pulsante; il menu si apre tenendo premuto (azione `longpress`) o con
    il tasto destro su computer;
  - trascinando un fumetto a destra si risponde;
  - `ActionSheet`, costruito su `Dialog`, serve anche al pulsante unico "Carica foto" (fotocamera
    o galleria).

## Motivazioni

- **Soft delete:** stesso comportamento di WhatsApp, e nessun buco nei riferimenti delle risposte.
- **Stato per persona sulla riga della conversazione:** due persone per conversazione, quindi due
  colonne bastano. Una tabella a parte per queste informazioni sarebbe esagerata (YAGNI).
- **Segnale di scrittura effimero:** salvarlo costerebbe scritture continue per un'informazione
  che vale 5 secondi.

## Conseguenze negative

- Un messaggio "eliminato per tutti" lascia comunque una riga nel database fino al reset.
- **L'inoltro di foto e vocali occupa spazio:** ogni copia è un file. Il limite di 5 chat per
  volta contiene il problema, ma non lo elimina.
- **Il "sta scrivendo" può mentire per qualche secondo:** chi smette di scrivere resta
  "sta scrivendo" fino a 5 s.
- **Anche la modifica è senza limiti:** si può cambiare il senso di un messaggio vecchio. È
  segnalato solo da "modificato", senza storico.
- **La chiave del canale personale** è nota alle persone con cui si ha una chat, come già in 0015:
  chi la conosce potrebbe mandare segnali falsi (solo "aggiorna" o "sta scrivendo", mai
  contenuti).

## Quando riaprirla

- Se serve la moderazione dei messaggi da parte dell'admin (oggi la chat resta privata).
- Se lo spazio del bucket `chat` diventa un problema: limitare l'inoltro dei file, o far
  condividere i file alle copie tenendo il conto delle chat che li usano.
