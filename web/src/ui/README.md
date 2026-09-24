# ui — sistema di stili

Tutto l'aspetto grafico dell'app nasce qui. Le schermate non definiscono colori, ombre o
animazioni proprie: usano i token del tema e questi componenti. Un elemento grafico nuovo si
aggiunge qui, non nella schermata che per prima ne ha bisogno.

## Tema
- `theme/tokens.css`: colori, gradienti, tipografia, spaziature, raggi, ombre, durate e curve
  delle animazioni, z-index, aree sicure dei telefoni con notch. Solo tema scuro.
- `theme/base.css`: reset e stili globali; rispetta "riduci movimento" del sistema.
- `theme/motion.ts`: durate per le transizioni Svelte (duplicano i token `--duration-*`,
  perché le transizioni JS vogliono numeri). Con "riduci movimento" diventano 0.
- `icons.ts`: tracciati SVG delle icone. `tone.ts`: `Tone` (`bonus` | `malus` | `common`).

## Componenti
| Componente | Uso |
|---|---|
| `Screen` | contenitore di pagina: larghezza massima, margini, spazio per tab bar o footer fisso |
| `ScreenHeader` | occhiello + titolo a gradiente + testo |
| `Button` | `primary` (gradiente) o `ghost` (vetro), stato `loading` |
| `TextField` | campo con etichetta flottante, suggerimento ed errore animato |
| `Stepper` | − valore + con animazione del numero e coriandoli (`Burst`) sul + |
| `SegmentedControl` | scelta tra poche opzioni con indicatore che scorre |
| `TabBar` | barra di navigazione fluttuante in basso |
| `Surface` | pannello "vetro", eventualmente evidenziato nel colore del tono |
| `Badge`, `Avatar`, `AnimatedNumber`, `Icon` | elementi minori |
| `EmptyState`, `Loader` | stati vuoti e caricamento |
| `ToastHost` + `toasts` | avvisi temporanei in alto (`toasts.show(messaggio, tono)`) |
| `PartyBackground` | sfondo animato |

## Relazioni
- Dipende da: nessun altro modulo dell'app (non conosce il dominio).
- Usato da: `features/`, `app/`.
- Dati posseduti: la coda degli avvisi (`toasts`).
