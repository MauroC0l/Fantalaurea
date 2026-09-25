# features

Le schermate e il loro stato.

## Ingresso
- `rules/RulesScreen`: regole brevi ("Le regole") e funzioni dell'app ("Anche nell'app", solo
  quelle accese: prop `features`; prima di entrare si mostrano tutte). Con `onjoin` è il
  benvenuto del primo accesso.
- `join/SecretWordScreen`: parola della serata (e link "Sei l'admin?").
- `join/JoinScreen`: nickname + nome vero (in modalità admin: "Entra come admin", con
  Indietro); se il nome vero esiste già chiede "Sei tu?"
  (prendi il vecchio profilo / sono un'altra persona / annulla).

## Giocatore (tab Bacheca · Azioni · Classifica · Chat · Profilo)
Bacheca, Classifica e Chat si possono spegnere dall'admin (ADR 0014): la loro scheda sparisce
e chi ci si trova sopra torna alle Azioni (la regola sta in `App.svelte`).

- `feed/FeedScreen` + `FeedCard`, `PostComposerDialog`, `LikersDialog`,
  `feed-state.svelte.ts`: post e schede delle azioni, pagine infinite (una pagina più corta di
  `FEED_PAGE_SIZE` vuol dire che non c'è altro), doppio tocco per il like, cuore immediato
  (annullato se il server rifiuta), elenco di chi ha messo like, eliminazione dei propri post,
  aggiornamento in tempo reale.
- `actions/ActionsScreen` (+ `ActionItem`, `CompletedItem`, `PhotoConfirmDialog`): punti,
  avanzamento, filtri per tipo e difficoltà, completamento con o senza foto (scattata ora o
  presa dalla galleria, con il pulsante unico `PhotoPickerButton`), annulla, elimina foto.
- `participants/ParticipantsScreen`: classifica per punti; ogni riga apre il profilo.
- `profile/ProfileScreen` + `BioEditorDialog`, `profile-state.svelte.ts`: foto profilo,
  nickname, nome vero, punti, posizione (solo con `showRank`, cioè classifica accesa), bio,
  foto, azioni completate (in una `ScrollArea`: sotto c'è altro). Toccando la foto profilo
  si ingrandisce (`Lightbox`). Sul proprio profilo: cambia/togli foto, modifica bio, regole, esci.
  Sul profilo di un altro, con la chat accesa, "Invia messaggio" (`onmessage`).
- `chat/` (ADR 0015, 0016 "come WhatsApp"):
  - `chat-list-state.svelte.ts`: `ChatListState`, le conversazioni aperte e il totale dei non
    letti (il badge della scheda Chat, con `unreadOf`). Vive per tutta la sessione; si aggiorna
    con la propria inbox e quando cambia `players` (nickname e foto degli altri).
    `toggleUnread` ("Segna come letta / da leggere") e `clear(conversation, 'empty' |
    'remove')` sono ottimisti: la lista cambia subito e, se il server rifiuta, si rilegge.
  - `typing-tracker.svelte.ts`: `TypingTracker`, quali conversazioni mostrano "sta
    scrivendo…" (ascolta `Chat.onTyping`; ogni segnale lo tiene acceso `TYPING_SHOWN_MS`, un
    messaggio arrivato lo spegne con `settle`). La stessa classe serve alla lista e alla
    conversazione, ognuna con la sua istanza.
  - `chat-layout.ts`: `layoutMessages`, funzione pura che aggiunge ai messaggi i separatori
    dei giorni e i gruppi di fumetti (stessa persona, stesso giorno, meno di 5 minuti tra
    l'uno e l'altro). Sta qui e non nel dominio perché dipende dalle etichette (`formatDay`).
  - `ChatListScreen`: elenco delle conversazioni con anteprima (o "sta scrivendo…"), ora e
    non letti. Tenendo premuta una chat (`longpress`) si apre un `ActionSheet`: segna come
    letta / da leggere, "Svuota messaggi", "Cancella chat" (queste due chiedono conferma).
  - `conversation-state.svelte.ts`: `ConversationState`, una conversazione aperta: messaggi
    dal più vecchio, pagine precedenti a richiesta (`CHAT_PAGE_SIZE`), invio di testo, foto e
    vocali, link dei file chiesti in gruppo, segna come letta e avvisa la lista (`onRead`).
    `mode` (`ComposerMode` = `new` | `reply` | `edit`, con il messaggio) dice cosa sta facendo
    il composer: un solo campo, così "rispondo e modifico insieme" non si può rappresentare.
    `deleteMessage(message, scope)` è immediato ("per me" lo toglie, "per tutti" lascia
    "Messaggio eliminato") e torna indietro se il server rifiuta; `forward`; `typed()` a ogni
    tasto, che avvisa l'altra persona al massimo ogni `TYPING_SIGNAL_EVERY_MS`; `peerTyping`.
  - `ForwardDialog`: scelta delle chat a cui inoltrare (fino a `FORWARD_MAX`), con
    `SelectableRow` dentro una `ScrollArea`.
  - `ConversationScreen`: `TopBar` con l'altra persona (e "sta scrivendo…"), separatori dei
    giorni, fumetti raggruppati, lightbox per le foto, composer con foto, testo e microfono
    (registra fino a `VOICE_MAX_MS`, poi invia da solo) e il `ComposerBanner` di risposta o
    modifica. Tenendo premuto un messaggio si apre il menu (`actionsFor`: rispondi, copia testo
    con `Clipboard`, modifica, inoltra, elimina per me / per tutti); trascinandolo a destra si
    risponde; toccando una citazione si salta al messaggio citato, se è già caricato, e lo si
    illumina. Riceve `chatList` per l'elenco delle chat dell'inoltro. Nasconde la tab bar.
- `game/game-state.svelte.ts`: catalogo, completamenti, classifica e funzioni accese
  (`features`, riletto quando cambia `evening_settings`); `SessionExpiredError` →
  `onSessionLost`.
- `photos/photo-links.svelte.ts`: `PhotoLinksCache`, i link delle foto come stato reattivo;
  le richieste fatte durante un rendering partono insieme.

## Admin (tab Azioni · Album · Serata)
- `admin/AdminActionsScreen` + `ActionEditorDialog`: lista, crea, modifica, elimina azioni.
- `admin/AlbumScreen` + `album-state.svelte.ts`: tutte le foto (azioni e post), condividi,
  ZIP, elimina (moderazione). Schermata `wide`: su computer la griglia riempie la finestra
  (colonne automatiche da 700 px). Il visore mostra tipo, titolo dell'azione o didascalia del
  post (come testo da leggere, non come titolo), autore, data e ora e scorre tra le foto; dopo
  un'eliminazione passa alla foto successiva. Le foto della chat non ci sono.
- `admin/EveningScreen`: parola della serata (condividi, copia, cambia: chi è dentro resta o
  esce), "Funzioni della serata" (interruttori Azioni / Bacheca / Chat / Classifica), log accessi
  admin (in una `ScrollArea`), "Termina e ricomincia" con promemoria delle foto.
- `admin/admin-state.svelte.ts`: catalogo, partecipanti, parola, funzioni e log in tempo
  reale. `setFeature` è ottimista: l'interruttore si sposta subito e torna indietro se il
  server rifiuta.

## Condivisi
- `routes.ts`: i percorsi (`Route`, `hrefTo`), usati dai link e dal router di `app/`; tra
  questi `chat` e `conversazione/<id>`.
- `labels.ts`: etichette, formato dell'ora, "5 min fa", `formatDay` ("Oggi", "Ieri", "ven 25
  set") e `startOfDay`, nome leggibile del dispositivo.
- Ogni scelta di foto (azioni, post, foto profilo, chat) usa lo stesso `PhotoPickerButton` di
  `ui/`: fotocamera o galleria si sceglie lì, non nelle schermate.

## Relazioni
- Dipende da: `application/`, `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`, `Chat.onInbox`, `Chat.onTyping`.
- Dati posseduti: stato in memoria di partita, bacheca, chat, profili, pannello e album.
