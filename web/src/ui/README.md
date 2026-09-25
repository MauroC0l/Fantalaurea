# ui — sistema di stili

Tutto l'aspetto grafico dell'app nasce qui. Le schermate non definiscono colori, ombre o
animazioni proprie: usano i token del tema e questi componenti. Un elemento grafico nuovo si
aggiunge qui, non nella schermata che per prima ne ha bisogno.

## Tema
- `theme/tokens.css`: colori, gradienti, tipografia, spaziature, raggi, ombre, durate e curve
  delle animazioni, z-index, aree sicure dei telefoni. Solo tema scuro. Larghezze:
  `--content-max` (560 px, la colonna da telefono) e `--content-wide` (1120 px, griglie di foto
  su computer). `--color-surface-bar` è la superficie quasi opaca delle barre con testo
  (`TopBar`, `TabBar`): il contenuto colorato che scorre sotto non deve trasparire. I fumetti
  della chat hanno i loro token: `--gradient-bubble-mine` (i colori della festa, ma abbastanza
  scuri per il testo bianco `--color-on-bubble-mine`), `--color-bubble-in` e
  `--color-bubble-in-border` (quelli ricevuti, opachi).
- `theme/base.css`: reset e stili globali; rispetta "riduci movimento".
- `theme/motion.ts`: durate per le transizioni Svelte (duplicano `--duration-*`).
- `icons.ts`: tracciati SVG delle icone (per la chat: `play`, `pause`, `mic`, `send`, `chat`,
  `reply`, `forward`, `unread`, `eraser`, `more`; per i sondaggi `poll`).
  `tone.ts`: `Tone` (`bonus` | `malus` | `common`).

## Azioni (`actions/`)
- `longpress.ts`: azione Svelte `use:longpress={handler}`. Tenere premuto 450 ms, o il tasto
  destro su computer, chiama `handler` (il menu "come WhatsApp", ADR 0016). Muovere il dito di
  oltre 10 px annulla: stava scorrendo. Il clic che chiude una pressione lunga viene
  inghiottito, altrimenti scatterebbe anche ciò che sta sotto il dito (un link, una foto).

## Componenti
| Componente | Uso |
|---|---|
| `Screen` | contenitore di pagina, spazio per tab bar o footer fisso; `wide` per le griglie di foto su computer |
| `ScreenHeader` | occhiello + titolo a gradiente + testo; `trailing` per un pulsante in alto a destra, `onback` per la freccia "Indietro" |
| `TopBar` | barra fissa in alto con freccia "Indietro" e contenuto libero (la usa la conversazione) |
| `Button` | `primary` / `ghost` / `danger`, taglia `regular` / `small`, stato `loading` |
| `IconButton` | pulsante tondo con sola icona; `danger`, `primary` (gradiente: l'azione principale di una barra, es. invia); aspetto spento se `disabled` |
| `PhotoPickerButton` | l'unico pulsante "Carica foto" (input nativi nascosti). Sul telefono apre un `ActionSheet` "Scatta una foto / Scegli dalla galleria"; con un puntatore preciso (computer) apre subito la galleria. La fotocamera ha un input suo con `capture="environment"`: alcuni Android (es. Xiaomi) altrimenti propongono solo la galleria. `label` serve quando il pulsante mostra solo un'icona |
| `TextField` | etichetta flottante, suggerimento, errore; `multiline`, `inputmode`, `counter` (caratteri rimasti) |
| `SegmentedControl` | scelta tra poche opzioni con indicatore che scorre |
| `ChipGroup` | scelta singola tra molte opzioni brevi (`role="radiogroup"`, `value` bindabile): le "pastiglie" vanno a capo sugli schermi stretti, dove un `SegmentedControl` non ci starebbe. Lo usano durata e visibilità dei risultati di un sondaggio. Con `scroll` resta su una riga che scorre di lato e arriva ai bordi dello schermo, così si vede che continua: i filtri sopra un elenco (quelli delle Azioni, ADR 0021) |
| `DurationPicker` | durata scelta liberamente (ADR 0021), disegnata da noi invece del selettore di sistema: ore e minuti, ciascuno con − e +, i minuti a passi di 5, riepilogo "1 h 30 min". `value` in minuti (bindabile), `min` (5 di base) e `max` obbligatorio. Lo aprono sfide e sondaggi con la scelta "Personalizzata" |
| `Switch` | interruttore con etichetta e descrizione |
| `Disclosure` | tendina: riepilogo sempre visibile, contenuto che si apre animato |
| `Dialog` | pannello dal basso con sfondo sfocato; Esc o tocco fuori per chiudere. Conta i pannelli aperti: con un pannello sopra un altro (la scelta della foto dentro una conferma) la pagina si sblocca solo quando si chiude l'ultimo |
| `ActionSheet` | menu di scelte costruito su `Dialog`: voci `{ icon, label, danger, onselect }`, contenuto facoltativo sopra le voci. `onselect` parte in modo sincrono dentro il tocco, perché fotocamera e galleria si aprono solo da un gesto dell'utente |
| `ScrollArea` | elenco che scorre dentro un pannello o con altro contenuto sotto (`maxHeight`): barra nativa nascosta, cursore disegnato da noi (trascinabile su computer), bordi sfumati quando c'è altro sopra o sotto |
| `SelectableRow` | riga selezionabile con spunta tonda disegnata da noi (`role="checkbox"`) |
| `Lightbox` | foto a schermo intero con didascalia e azioni; con `onprevious` / `onnext` frecce, scorrimento col dito, tasti freccia e `position` ("3 di 12"). Sul telefono una didascalia lunga scorre (al massimo 45 % dell'altezza) invece di schiacciare la foto; da 900 px diventa foto + pannello laterale di 380 px |
| `Thumbnail` | miniatura quadrata con caricamento animato |
| `PhotoFrame` | foto della bacheca (4:5): un tocco apre, doppio tocco mette like con cuore animato |
| `LikeButton` | cuore + "Piace a N persone" (apre l'elenco) |
| `MessageBubble` | fumetto di un messaggio (i miei a destra, colorati), con l'ora in basso a destra come su WhatsApp. È un `div`, non un pulsante: un pulsante disattivato bloccava il play dei vocali che conteneva. `groupStart` / `groupEnd` (i messaggi di fila si stringono), `media` (foto a filo, ora sopra la foto), `voice`, `deleted`, `edited`, `forwarded`, `quote` (il messaggio a cui risponde, toccabile), `highlighted`; `onmenu` alla pressione lunga, `onreply` trascinandolo a destra. La riga ritaglia lo spostamento (`overflow-x: clip`): senza, trascinare un fumetto attaccato al bordo allargava la pagina e spingeva fuori schermo la X del compositore |
| `ComposerBanner` | striscia sopra il campo di testo: a cosa risponde o cosa corregge il prossimo messaggio, con "Annulla" |
| `DayDivider` | separatore tra i giorni ("Oggi", "Ieri", "ven 25 set") |
| `TypingIndicator` | tre puntini in un fumetto: "sta scrivendo" |
| `MessageInput` | campo di testo che cresce fino a qualche riga; Invio invia solo con un puntatore preciso (computer), sul telefono va a capo. `oninput` a ogni tasto, `focus()` esportato |
| `VoicePlayer` | riproduttore di vocali disegnato da noi sopra un `Audio` nascosto: play/pausa, durata e un'onda finta ma stabile (dipende da `seed`, es. l'id del messaggio: l'onda vera richiederebbe di decodificare l'audio); un tocco sull'onda salta a quel punto |
| `RecordingIndicator` | registrazione in corso: punto pulsante, tempo trascorso, secondi rimasti vicino al limite |
| `ProgressBar` | barra di avanzamento a gradiente |
| `ResultBar` | un'opzione di un sondaggio con il suo risultato: riempimento da sinistra in proporzione a `share` (0–100), percentuale e voti; `mine` aggiunge la spunta del proprio voto, `leading` il colore più forte di chi è in testa |
| `AvatarStack` | facce sovrapposte con "+N" oltre `max` (5), per esempio chi ha votato un'opzione; con `onclick` diventa toccabile (l'elenco completo), senza è spento. `label` per i lettori di schermo |
| `DifficultyMeter` | difficoltà come 1-3 fiamme colorate |
| `PointsPill` | punti con segno, verde se positivi e rosso se negativi |
| `TabBar` | barra di navigazione fluttuante; ogni scheda può avere un `badge` (non letti, "99+" oltre 99). Da 6 schede in su le parole non ci stanno su un telefono: le etichette si nascondono alla vista (i lettori di schermo le leggono ancora) e le icone crescono a 24 px (ADR 0019) |
| `Surface` | pannello "vetro", evidenziabile nel colore del tono |
| `Avatar` | iniziali colorate o foto profilo; taglie `sm` / `md` / `lg` |
| `Badge`, `AnimatedNumber`, `Icon` (anche piena, `filled`) | elementi minori |
| `EmptyState`, `Loader` | stati vuoti e caricamento |
| `ToastHost` + `toasts` | avvisi temporanei (`toasts.show(messaggio, tono)`) |
| `CelebrationHost` + `celebrations` | coriandoli a centro schermo (`celebrations.burst(tono)`), con `Burst` |
| `PartyBackground` | sfondo animato |

## Trappole
- Un elenco fatto con CSS grid deve dichiarare `grid-template-columns: minmax(0, 1fr)`. Con
  la colonna implicita un testo `nowrap` o con i puntini allarga la colonna, e con lei la
  pagina, invece di troncarsi. `Screen` lo fa già; gli elenchi dentro le schermate devono farlo
  da sé (scoperto con dati di prova pesanti: nickname e anteprime lunghi).

## Relazioni
- Dipende da: nessun altro modulo dell'app (non conosce il dominio).
- Usato da: `features/`, `app/`.
- Dati posseduti: le code di avvisi e coriandoli.
