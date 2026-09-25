# features

Le schermate e il loro stato.

## Ingresso
- `rules/RulesScreen`: tre regole (Azioni, Prove, Per tutti; il testo l'ha scelto l'utente, ADR
  0021) e, sotto "Possibilità", le funzioni dell'app come riquadri su due colonne: non sono
  regole ma cose che si possono fare, e compaiono solo quelle accese (prop `features`, sfide a
  tempo comprese; prima di entrare si mostrano tutte; il Profilo c'è sempre). Con `onjoin` è il
  benvenuto del primo accesso.
- `join/SecretWordScreen`: parola della serata (e link "Sei l'admin?").
- `join/JoinScreen`: nickname + nome vero (in modalità admin: "Entra come admin", con
  Indietro); se il nome vero esiste già chiede "Sei tu?"
  (prendi il vecchio profilo / sono un'altra persona / annulla). A un giocatore bloccato
  (`blocked`) dice che l'admin lo ha tolto dalla serata. Le risposte sono gestite con uno
  `switch` esaustivo (`satisfies never`): un errore nuovo nella porta non compila finché la
  schermata non lo gestisce.

## Giocatore (tab Bacheca · Azioni · Classifica · Chat · Sondaggi · Profilo)
Bacheca, Classifica, Chat e Sondaggi si possono spegnere dall'admin (ADR 0014): la loro scheda sparisce
e chi ci si trova sopra torna alle Azioni (la regola sta in `App.svelte`).

- `feed/FeedScreen` + `FeedCard`, `PostComposerDialog`, `LikersDialog`,
  `feed-state.svelte.ts`: due sezioni scelte con un `SegmentedControl`, "Post" e "Imprese"
  (azioni completate e sfide a tempo completate, ADR 0021). `FeedState.section` è quella
  mostrata; `show(section)` svuota l'elenco e carica la pagina più recente dell'altra sezione,
  che il server pagina a parte; una pagina arrivata dopo il cambio di sezione si scarta. Pagine
  infinite (una pagina più corta di `FEED_PAGE_SIZE` vuol dire che non c'è altro), doppio tocco
  per il like, cuore immediato (annullato se il server rifiuta), elenco di chi ha messo like,
  eliminazione dei propri post, aggiornamento in tempo reale (anche quando cambia
  `challenges`). `FeedCard` scrive "ha vinto la sfida a tempo" per un'impresa con `timed`.
- `actions/ActionsScreen` (+ `ActionItem`, `CompletedItem`, `PhotoConfirmDialog`): punti,
  avanzamento, filtri per tipo e difficoltà, completamento con o senza foto (scattata ora o
  presa dalla galleria, con il pulsante unico `PhotoPickerButton`), annulla, elimina foto.
  I filtri (Tutte / Bonus / Malus / A tempo / Fatte) sono un `ChipGroup` con `scroll`, su una
  riga che scorre di lato. Le sfide a tempo arrivano con la prop facoltativa `timed` (ADR 0021:
  `{ todo, done, total, board, doneList }`, solo numeri e due snippet), così la schermata non sa
  cosa sia una sfida:
  - il filtro "A tempo" c'è solo con `timed`, porta il numero di sfide ancora da fare (`todo`) e
    mostra `board`; se l'admin spegne le sfide mentre è scelto, si torna a "Tutte";
  - il contatore "X su N completate" e "Fatte N" sommano azioni e sfide (`done`, `total`);
  - "Fatte" comincia con `doneList` (le sfide fatte) e mostra lo stato vuoto solo se non si è
    fatto niente di niente.
- `challenges/` (ADR 0020), la stessa cartella per giocatori e admin:
  - `challenges-state.svelte.ts`: `ChallengesState`. **Vive per tutta la sessione**, non con la
    schermata: lo avvia `App.svelte` all'ingresso, perché l'avviso di una sfida nuova serve
    proprio quando non si è sulle Azioni. Derivati `running`, `finished` e `todo` (quante se ne
    possono ancora fare, con `openFor`: il badge della scheda Azioni). Un orologio (`now`)
    avanza ogni 5 s: i conti alla rovescia scendono e una sfida scaduta passa tra le finite
    senza rileggere. `mine` sono le sfide completate da questo giocatore (per "Fatte");
    `completers(challenge)` legge a richiesta chi l'ha fatta (`null` se la lettura fallisce;
    sessione scaduta → `onSessionLost`). Si rilegge quando cambiano `challenges` o `players`. `onNew` scatta solo
    per sfide comparse **dopo la prima lettura** e in corso (quelle già aperte quando entri non
    sono "nuove"); una sfida creata da te non è nuova per te. Il getter `player` è `null` per
    l'admin, che crea e gestisce ma non partecipa (`complete` e `undo` rispondono
    `unauthorized`). `create` e `update` validano con `validateChallenge` prima di chiamare il
    server (`SaveChallengeError` = `ChallengeFailure` | errori della bozza); le operazioni su una
    sfida la segnano `busy`. Dopo ogni risposta rilegge; `unauthorized` → sessione persa.
  - `ChallengesSection`: due viste (`view`). `board` (predefinita) è il contenuto del filtro "A
    tempo" delle Azioni e la sezione in cima alle azioni dell'admin: pulsante "Nuova" solo con
    `canCreate`; sfide in corso, poi le finite (le prime 3, "Mostra tutte (N)"); si nasconde se
    non ci sono sfide e non se ne possono creare. `mine` è l'inizio di "Fatte": solo le sfide
    completate, seguite dal sottotitolo "Azioni"; nulla se non ce ne sono. Toccando "N l'hanno
    fatta" su una scheda si apre un `Dialog` con tutti, in ordine di arrivo (`ScrollArea`):
    posizione, foto profilo, nickname e ora, oppure "senza punti" in grigio per chi è arrivato
    dopo i primi N. "Gestisci" apre un `ActionSheet`: Modifica,
    Termina adesso (solo se in corso), Elimina con conferma in un `Dialog`. Ogni
    `ChallengeFailure` ha il suo avviso.
  - `ChallengeCard`: badge con il tempo che resta (`formatTimeLeft`) o "Finita", autore, punti,
    a chi vanno i punti e i posti rimasti, `AvatarStack` di chi l'ha fatta; "Fatta!" e, mentre è
    in corso, "Annulla". Dopo: "Fatta! Sei N°", oppure "fuori dai primi: niente punti" se il
    limite è stato abbassato (`earnedPoints`). `oncompleters`: la riga "N l'hanno fatta" è un
    pulsante che apre l'elenco completo.
  - `ChallengeEditorDialog`: titolo, descrizione, `ChipGroup` per punti (5–50), vincitori
    (`CHALLENGE_WINNERS`) e durata (`CHALLENGE_DURATIONS` più "Personalizzata", che apre un
    `DurationPicker` fino a `CHALLENGE_DURATION_MAX`, 12 ore; ADR 0021). In modifica la durata
    offre anche "Non cambiare" (predefinito): scegliere una durata fa ripartire il tempo da adesso.
    Esporta dal `<script module>` il tipo `ChallengeForm` (`minutes` `null` = non cambiare),
    che `ChallengesSection` trasforma in `ChallengeDraft` o `ChallengeEdit`.
- `participants/ParticipantsScreen`: classifica per punti; ogni riga apre il profilo.
- `profile/ProfileScreen` + `BioEditorDialog`, `profile-state.svelte.ts`: foto profilo,
  nickname, nome vero, punti, posizione (solo con `showRank`, cioè classifica accesa), bio,
  foto, azioni completate (in una `ScrollArea`: sotto c'è altro), che con `deedsOf` comprendono
  anche le sfide a tempo, segnate "A tempo" (ADR 0021). Toccando la foto profilo
  si ingrandisce (`Lightbox`). Sul proprio profilo: "Ne usi N di 100" (da `photoCount`, in
  rosso al limite), cambia/togli foto, modifica bio, regole, esci.
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
    illumina. Riceve `chatList` per l'elenco delle chat dell'inoltro. Nasconde la tab bar. La
    griglia del composer dichiara `minmax(0, 1fr)` (vedi le trappole di `ui/`): senza, un
    messaggio citato lungo allargava la colonna e la X del `ComposerBanner` finiva fuori schermo.
- `polls/` (ADR 0019), la stessa cartella per giocatori e admin:
  - `polls-state.svelte.ts`: `PollsState`, con una sessione di giocatore o di admin. `voter` è
    `null` per l'admin, che crea e gestisce ma non vota. Si rilegge quando cambiano `polls` o
    `players` (entra qualcuno, un bloccato sparisce, un permesso cambia); un orologio (`now`)
    avanza ogni 15 s, così i conti alla rovescia scendono e un sondaggio a tempo passa tra i
    chiusi senza rileggere. `create` valida la bozza con `validatePollDraft` prima di chiamare
    il server (`CreatePollError` = `PollFailure` | errori della bozza); `vote`, `close` e
    `remove` segnano il sondaggio come occupato (`busy`, un id alla volta). Dopo ogni risposta,
    anche un rifiuto, rilegge l'elenco: conteggi, chiusure e permessi possono essere cambiati;
    `unauthorized` → sessione persa. Parte e si ferma con la schermata.
  - `PollsScreen`: sezioni "aperti" e "chiusi" (con `isOpen`, quindi seguono l'orologio),
    pulsante "Nuovo" solo con `canCreate` (admin, o giocatore con il permesso, ADR 0018).
    "Gestisci" apre un `ActionSheet`: chiudi, o elimina con conferma. Toccando le facce di
    un'opzione si apre l'elenco dei votanti in un `Dialog` con `ScrollArea`. Ogni `PollFailure`
    ha il suo avviso.
  - `PollCard`: si scelgono le opzioni (`SelectableRow`, una o più secondo le regole) e poi si
    preme "Vota", invece di votare al primo tocco: con il voto non modificabile un tocco
    sbagliato sarebbe definitivo. "Cambia voto" quando le regole lo permettono. I risultati sono
    `ResultBar` (in testa evidenziate a sondaggio chiuso) e `AvatarStack` dei votanti (non negli
    anonimi); se il server li nasconde, una riga spiega quando si vedranno. Un badge mostra il
    tempo che resta.
  - `PollEditorDialog`: domanda, da 2 a 10 opzioni (aggiungi / togli), `Switch` per anonimo, più
    scelte e cambio voto, `ChipGroup` per visibilità dei risultati e durata (`POLL_DURATIONS` più
    "Personalizzata", che apre un `DurationPicker` fino a `POLL_DURATION_MAX`, 24 ore); gli errori
    della bozza diventano messaggi. Si ripulisce a ogni apertura. La chiusura "quando hanno
    votato tutti" non c'è più (ADR 0021): per l'utente "automatica" voleva dire "a tempo".
- `game/game-state.svelte.ts`: catalogo, completamenti, classifica, funzioni accese
  (`features`, riletto quando cambia `evening_settings`) e `permissions` (cosa l'admin gli
  lascia creare, ADR 0018; riletto con il resto, anche quando cambia `players`);
  `SessionExpiredError` → `onSessionLost`. Si rilegge anche quando cambia `challenges`: i punti
  delle sfide entrano in classifica.
- `photos/photo-links.svelte.ts`: `PhotoLinksCache`, i link delle foto come stato reattivo;
  le richieste fatte durante un rendering partono insieme.

## Admin (tab Azioni · Utenti · Sondaggi · Album · Serata)
La scheda Sondaggi è la stessa `polls/PollsScreen` dei giocatori, con `canCreate` sempre vero
e senza il pulsante "Vota".

- `admin/AdminActionsScreen` + `ActionEditorDialog`: lista, crea, modifica, elimina azioni.
  Accetta uno snippet `top`: in cima c'è la stessa `ChallengesSection` dei giocatori (vista
  `board`), con cui l'admin crea e gestisce le sfide, solo quando le sfide sono accese.
- `admin/UsersScreen` + `users-state.svelte.ts` (ADR 0018):
  - `UsersState`: tutti i giocatori (`EveningAdmin.players`), bloccati compresi. Si rilegge
    quando cambiano `players`, `posts` o `player_completions` (chi entra, foto che arrivano o
    spariscono). `setPermission` e `setBlocked` sono ottimisti: la riga cambia subito e torna
    com'era se il server rifiuta.
  - `UsersScreen`: ricerca per nickname o nome vero (`matchesSearch`), filtri Tutti / Con
    permessi / Bloccati, righe dei bloccati in grigio con il badge "Bloccato", foto usate su
    `PHOTO_LIMIT` (evidenziate al limite). Toccando una riga si apre la scheda: nome vero, foto,
    ora di ingresso, interruttori dei permessi (spenti per un bloccato) e "Blocca" (con
    conferma) / "Sblocca". Riceve la `PhotoLinksCache` per le foto profilo.
- `admin/AlbumScreen` + `album-state.svelte.ts`: tutte le foto (azioni e post), condividi,
  ZIP, elimina (moderazione). Export a parti da 100 (`EXPORT_PART_SIZE`): una sola parte in
  memoria alla volta, perché 500 foto vere (circa 1,5 MB l'una) farebbero chiudere il browser
  del telefono; nomi dei file brevi e unici su tutto l'album (Windows non estrae percorsi oltre
  260 caratteri), foto scaricate a gruppi di 6 con nuovi tentativi. Download guidato (ADR 0021):
  - sulla schermata c'è un solo pulsante, "Scarica tutte (N)", che apre un `Dialog`: spiega
    quanti ZIP verranno scaricati e perché (tutte insieme farebbero chiudere la pagina) e
    ricorda di accettare il permesso del browser per i download multipli;
  - "Scarica N ZIP" chiama `AlbumState.downloadAll`: prepara una parte, la scarica come ZIP, la
    toglie dalla memoria e aspetta 0,8 s prima della successiva. Il pannello mostra "ZIP X di N"
    con l'avanzamento e non si chiude finché lavora; se qualcosa fallisce torna alla
    spiegazione con un avviso;
  - "Salva nel rullino (iPhone)" mostra i gruppi da 100, ciascuno con "Prepara il gruppo" e poi
    "Condividi N foto": la condivisione vuole un tocco dell'utente per volta, quindi non si può
    automatizzare. Schermata `wide`: su computer la griglia riempie la finestra
  (colonne automatiche da 700 px). Il visore mostra tipo, titolo dell'azione o didascalia del
  post (come testo da leggere, non come titolo), autore, data e ora e scorre tra le foto; dopo
  un'eliminazione passa alla foto successiva. Le foto della chat non ci sono.
- `admin/EveningScreen`: parola della serata (condividi, copia, cambia: chi è dentro resta o
  esce), "Funzioni della serata" (interruttori Azioni / Bacheca / Chat / Classifica / Sondaggi / Sfide a tempo), log accessi
  admin (in una `ScrollArea`), "Termina e ricomincia" con promemoria delle foto.
- `admin/admin-state.svelte.ts`: catalogo, partecipanti, parola, funzioni e log in tempo
  reale. `setFeature` è ottimista: l'interruttore si sposta subito e torna indietro se il
  server rifiuta.

## Condivisi
- `routes.ts`: i percorsi (`Route`, `hrefTo`), usati dai link e dal router di `app/`; tra
  questi `chat`, `conversazione/<id>`, `utenti` e `sondaggi` (uguale per giocatore e admin).
- `labels.ts`: etichette, formato dell'ora, "5 min fa", `formatTimeLeft` (conti alla rovescia:
  "14 min", "1 h 5 min", "meno di 1 min"), `formatDay` ("Oggi", "Ieri", "ven 25
  set") e `startOfDay`, nome leggibile del dispositivo, `PHOTO_LIMIT_MESSAGE` (lo stesso
  avviso per `photo-limit` in Azioni, Bacheca e chat).
- Ogni scelta di foto (azioni, post, foto profilo, chat) usa lo stesso `PhotoPickerButton` di
  `ui/`: fotocamera o galleria si sceglie lì, non nelle schermate.

## Relazioni
- Dipende da: `application/`, `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`, `Chat.onInbox`, `Chat.onTyping`.
- Dati posseduti: stato in memoria di partita, bacheca, chat, profili, pannello, utenti, album,
  sondaggi e sfide.
