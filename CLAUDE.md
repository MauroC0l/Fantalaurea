# Fantalaurea — regole di lavoro

Regole da seguire SEMPRE, in ogni sessione.

## Come lavoriamo

PRIMA SI PENSA, POI SI SCRIVE. Nessuna riga di codice prima di aver definito insieme: il
problema, gli use case (con flussi alternativi e di errore), l'architettura, i contratti e
come si verifica che funzioni. Vale anche per i lavori piccoli: su un lavoro da dieci minuti
il ragionamento dura un minuto, ma si fa.

LE DECISIONI IMPORTANTI LE PRENDE L'UTENTE. Stack, architettura, modello dei dati, contratti
pubblici, scope: chiedere sempre. Claude decide solo le scelte locali e reversibili — nomi,
suddivisione delle funzioni, dove mettere un file in una struttura già decisa.

NON FERMARSI AL PRIMO DUBBIO. Se serve una decisione dell'utente, mettere da parte la domanda e
andare avanti con tutto il resto che non ne dipende. Quando non si può più procedere, fare TUTTE
le domande insieme, ognuna con contesto, opzioni, conseguenze e raccomandazione motivata.
Fermarsi subito solo se procedere renderebbe inutile o pericoloso il lavoro.

CONSIGLIARE ATTIVAMENTE. Proporre alternative anche quando non richieste, confrontarle con pro,
contro e costo, indicare quale si sceglierebbe e spiegare il PRINCIPIO che la motiva. L'utente è
alle prime armi con l'architettura: ogni scelta è anche un'occasione per fargli capire.
Segnalare i rischi prima che diventino problemi.

ESSERE DIRETTI. Niente piaggeria. Se una richiesta ha un problema tecnico, dirlo e proporre
l'alternativa. Se l'utente conferma lo stesso, quella è la decisione: eseguirla per intero
senza tornarci sopra.

## Dopo ogni implementazione

Spiegare NEL DETTAGLIO, ogni volta, non a fine giornata:
- COSA è stato implementato, in termini di comportamento;
- DOVE è stato scritto — file e righe, indicando cosa è nuovo e cosa modificato;
- COME è stato scritto — scelte tecniche, il perché di ciascuna, e le alternative scartate con
  la motivazione;
- COSA RESTA APERTO — TODO, limiti noti, debito tecnico introdotto di proposito.

## Qualità del codice

SOLID e buona architettura, sul serio: separazione dei livelli con le dipendenze che puntano
verso l'interno, dipendenza dalle astrazioni e non dalle implementazioni, interfacce piccole,
composizione invece di ereditarietà, stati impossibili resi irrappresentabili dai tipi.

DRY con giudizio (si astrae alla terza ripetizione reale, non alla prima somiglianza) e YAGNI:
non costruire per requisiti immaginari.

COMMENTI SOLO SE ESSENZIALI. Si commenta il PERCHÉ, mai il COSA: una scelta controintuitiva,
un vincolo esterno, un riferimento necessario. Il codice si spiega da sé con nomi chiari e
funzioni brevi. Niente codice commentato: per quello c'è git.

## Documentazione e decisioni

REGISTRO DELLE DECISIONI (ADR). Ogni scelta costosa da invertire, con alternative serie o
controintuitiva diventa un file in `docs/adr/`, scritto NEL MOMENTO in cui si decide. Un ADR non
si cancella: si supera con uno nuovo. Deve contenere contesto, decisione, motivazioni,
CONSEGUENZE NEGATIVE (obbligatorie) e le condizioni che la farebbero riaprire.

DOCUMENTAZIONE VIVA. Si aggiorna nella STESSA modifica che cambia il codice, mai dopo. Ogni
modulo ha un README.md che spiega responsabilità, API pubblica e SOPRATTUTTO COME SI RELAZIONA
CON GLI ALTRI MODULI: da chi dipende, chi lo usa, quali eventi pubblica e ascolta, quali dati
possiede. Ciò che una macchina può generare o verificare non si scrive a mano.

## Interfaccia

TUTTO LO STILE GRAFICO È PERSONALIZZATO AL 100%. Ogni elenco a discesa, finestra di dialogo,
avviso, selettore, interruttore, calendario: tutto disegnato da noi. Nessun componente di
sistema con l'aspetto predefinito, nessun colore o spaziatura scritti dentro una schermata —
tutto viene dal tema. Ogni elemento nuovo nasce nel sistema di stili, non dentro la schermata
che per prima ne ha bisogno.

Restano fuori le superfici che appartengono al sistema operativo: tastiera, dialoghi dei
permessi, pannello di condivisione, app fotocamera.

## Passaggio di consegne

Quando la sessione diventa pesante, a ogni blocco di lavoro completato o a ogni svolta della
conversazione, AGGIORNARE `claude_config/SESSION-STATE.md` e dirlo all'utente. Deve essere
scritto per chi non ha visto la conversazione: obiettivo, decisioni prese con le motivazioni,
stato attuale, cosa è in corso, prossimi passi, domande aperte e trappole. Date assolute,
percorsi verificati. Si sovrascrive, non si accumula: lo storico sta in git.

## Lingua

Italiano.
