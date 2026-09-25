# ui — sistema di stili

Tutto l'aspetto grafico dell'app nasce qui. Le schermate non definiscono colori, ombre o
animazioni proprie: usano i token del tema e questi componenti. Un elemento grafico nuovo si
aggiunge qui, non nella schermata che per prima ne ha bisogno.

## Tema
- `theme/tokens.css`: colori, gradienti, tipografia, spaziature, raggi, ombre, durate e curve
  delle animazioni, z-index, aree sicure dei telefoni. Solo tema scuro. Larghezze:
  `--content-max` (560 px, la colonna da telefono) e `--content-wide` (1120 px, griglie di foto
  su computer). `--color-surface-bar` è la superficie quasi opaca delle barre con testo
  (`TopBar`, `TabBar`): il contenuto colorato che scorre sotto non deve trasparire.
- `theme/base.css`: reset e stili globali; rispetta "riduci movimento".
- `theme/motion.ts`: durate per le transizioni Svelte (duplicano `--duration-*`).
- `icons.ts`: tracciati SVG delle icone (per la chat: `play`, `pause`, `mic`, `send`, `chat`).
  `tone.ts`: `Tone` (`bonus` | `malus` | `common`).

## Componenti
| Componente | Uso |
|---|---|
| `Screen` | contenitore di pagina, spazio per tab bar o footer fisso; `wide` per le griglie di foto su computer |
| `ScreenHeader` | occhiello + titolo a gradiente + testo; `trailing` per un pulsante in alto a destra, `onback` per la freccia "Indietro" |
| `TopBar` | barra fissa in alto con freccia "Indietro" e contenuto libero (la usa la conversazione) |
| `Button` | `primary` / `ghost` / `danger`, taglia `regular` / `small`, stato `loading` |
| `IconButton` | pulsante tondo con sola icona; `danger`, `primary` (gradiente: l'azione principale di una barra, es. invia); aspetto spento se `disabled` |
| `PhotoPickerButton` | pulsante che apre fotocamera / galleria (input nativo nascosto); con `camera` apre subito la fotocamera posteriore (`capture="environment"`) |
| `PhotoSourceButtons` | due `PhotoPickerButton` affiancati: "Scatta ora" (fotocamera) e "Galleria"; etichette personalizzabili |
| `TextField` | etichetta flottante, suggerimento, errore; `multiline`, `inputmode`, `counter` (caratteri rimasti) |
| `SegmentedControl` | scelta tra poche opzioni con indicatore che scorre |
| `Switch` | interruttore con etichetta e descrizione |
| `Disclosure` | tendina: riepilogo sempre visibile, contenuto che si apre animato |
| `Dialog` | pannello dal basso con sfondo sfocato; Esc o tocco fuori per chiudere |
| `Lightbox` | foto a schermo intero con didascalia e azioni; con `onprevious` / `onnext` frecce, scorrimento col dito, tasti freccia e `position` ("3 di 12"). Sul telefono una didascalia lunga scorre (al massimo 45 % dell'altezza) invece di schiacciare la foto; da 900 px diventa foto + pannello laterale di 380 px |
| `Thumbnail` | miniatura quadrata con caricamento animato |
| `PhotoFrame` | foto della bacheca (4:5): un tocco apre, doppio tocco mette like con cuore animato |
| `LikeButton` | cuore + "Piace a N persone" (apre l'elenco) |
| `MessageBubble` | fumetto di un messaggio con l'ora (i miei a destra, colorati); `media` per le foto a filo; `onselect` al tocco |
| `MessageInput` | campo di testo che cresce fino a qualche riga; Invio invia solo con un puntatore preciso (computer), sul telefono va a capo |
| `VoicePlayer` | riproduttore di vocali disegnato da noi sopra un `Audio` nascosto: play/pausa, avanzamento, durata |
| `RecordingIndicator` | registrazione in corso: punto pulsante, tempo trascorso, secondi rimasti vicino al limite |
| `ProgressBar` | barra di avanzamento a gradiente |
| `DifficultyMeter` | difficoltà come 1-3 fiamme colorate |
| `PointsPill` | punti con segno, verde se positivi e rosso se negativi |
| `TabBar` | barra di navigazione fluttuante; ogni scheda può avere un `badge` (non letti, "99+" oltre 99) |
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
