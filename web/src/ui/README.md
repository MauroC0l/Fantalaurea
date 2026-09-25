# ui — sistema di stili

Tutto l'aspetto grafico dell'app nasce qui. Le schermate non definiscono colori, ombre o
animazioni proprie: usano i token del tema e questi componenti. Un elemento grafico nuovo si
aggiunge qui, non nella schermata che per prima ne ha bisogno.

## Tema
- `theme/tokens.css`: colori, gradienti, tipografia, spaziature, raggi, ombre, durate e curve
  delle animazioni, z-index, aree sicure dei telefoni. Solo tema scuro.
- `theme/base.css`: reset e stili globali; rispetta "riduci movimento".
- `theme/motion.ts`: durate per le transizioni Svelte (duplicano `--duration-*`).
- `icons.ts`: tracciati SVG delle icone. `tone.ts`: `Tone` (`bonus` | `malus` | `common`).

## Componenti
| Componente | Uso |
|---|---|
| `Screen` | contenitore di pagina, spazio per tab bar o footer fisso |
| `ScreenHeader` | occhiello + titolo a gradiente + testo; `trailing` per un pulsante in alto a destra |
| `Button` | `primary` / `ghost` / `danger`, taglia `regular` / `small`, stato `loading` |
| `IconButton` | pulsante tondo con sola icona |
| `PhotoPickerButton` | pulsante che apre fotocamera / galleria (input nativo nascosto) |
| `TextField` | etichetta flottante, suggerimento, errore; `multiline`, `inputmode`, `counter` (caratteri rimasti) |
| `SegmentedControl` | scelta tra poche opzioni con indicatore che scorre |
| `Disclosure` | tendina: riepilogo sempre visibile, contenuto che si apre animato |
| `Dialog` | pannello dal basso con sfondo sfocato; Esc o tocco fuori per chiudere |
| `Lightbox` | foto a schermo intero con didascalia e azioni |
| `Thumbnail` | miniatura quadrata con caricamento animato |
| `PhotoFrame` | foto della bacheca (4:5): un tocco apre, doppio tocco mette like con cuore animato |
| `LikeButton` | cuore + "Piace a N persone" (apre l'elenco) |
| `ProgressBar` | barra di avanzamento a gradiente |
| `DifficultyMeter` | difficoltà come 1-3 fiamme colorate |
| `PointsPill` | punti con segno, verde se positivi e rosso se negativi |
| `TabBar` | barra di navigazione fluttuante |
| `Surface` | pannello "vetro", evidenziabile nel colore del tono |
| `Avatar` | iniziali colorate o foto profilo; taglie `sm` / `md` / `lg` |
| `Badge`, `AnimatedNumber`, `Icon` (anche piena, `filled`) | elementi minori |
| `EmptyState`, `Loader` | stati vuoti e caricamento |
| `ToastHost` + `toasts` | avvisi temporanei (`toasts.show(messaggio, tono)`) |
| `CelebrationHost` + `celebrations` | coriandoli a centro schermo (`celebrations.burst(tono)`), con `Burst` |
| `PartyBackground` | sfondo animato |

## Relazioni
- Dipende da: nessun altro modulo dell'app (non conosce il dominio).
- Usato da: `features/`, `app/`.
- Dati posseduti: le code di avvisi e coriandoli.
