# features

Le schermate e il loro stato.

## Ingresso
- `rules/RulesScreen`: regole; con `onjoin` è il benvenuto del primo accesso.
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
  presa dalla galleria, con `PhotoSourceButtons`), annulla, elimina foto.
- `participants/ParticipantsScreen`: classifica per punti; ogni riga apre il profilo.
- `profile/ProfileScreen` + `BioEditorDialog`, `profile-state.svelte.ts`: foto profilo,
  nickname, nome vero, punti, posizione (solo con `showRank`, cioè classifica accesa), bio,
  foto, azioni completate. Sul proprio profilo: cambia/togli foto, modifica bio, regole, esci.
  Sul profilo di un altro, con la chat accesa, "Invia messaggio" (`onmessage`).
- `chat/` (ADR 0015):
  - `chat-list-state.svelte.ts`: `ChatListState`, le conversazioni aperte e il totale dei non
    letti (il badge della scheda Chat). Vive per tutta la sessione; si aggiorna con la propria
    inbox e quando cambia `players` (nickname e foto degli altri).
  - `ChatListScreen`: elenco delle conversazioni con anteprima, ora e non letti.
  - `conversation-state.svelte.ts`: `ConversationState`, una conversazione aperta: messaggi
    dal più vecchio, pagine precedenti a richiesta (`CHAT_PAGE_SIZE`), invio di testo, foto e
    vocali, eliminazione dei propri messaggi, link dei file chiesti in gruppo, segna come letta
    e avvisa la lista (`onRead`).
  - `ConversationScreen`: `TopBar` con l'altra persona, fumetti, lightbox per le foto,
    composer con foto, testo e microfono (registra fino a `VOICE_MAX_MS`, poi invia da solo);
    un tocco su un proprio messaggio chiede se eliminarlo per tutti e due. Nasconde la tab bar.
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
  esce), "Funzioni della serata" (interruttori Bacheca / Chat / Classifica), log accessi
  admin, "Termina e ricomincia" con promemoria delle foto.
- `admin/admin-state.svelte.ts`: catalogo, partecipanti, parola, funzioni e log in tempo
  reale. `setFeature` è ottimista: l'interruttore si sposta subito e torna indietro se il
  server rifiuta.

## Condivisi
- `routes.ts`: i percorsi (`Route`, `hrefTo`), usati dai link e dal router di `app/`; tra
  questi `chat` e `conversazione/<id>`.
- `labels.ts`: etichette, formato dell'ora, "5 min fa", nome leggibile del dispositivo.

## Relazioni
- Dipende da: `application/`, `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`, `Chat.onInbox`.
- Dati posseduti: stato in memoria di partita, bacheca, chat, profili, pannello e album.
