# ADR 0005 — Admin con credenziali fisse e una sola serata attiva

Data: 2026-09-24 · Stato: accettata (decisione dell'utente)

## Contesto
Ogni festa è indipendente e alla fine i suoi dati si buttano. Ogni serata ha la sua lista di
azioni, che qualcuno deve poter modificare. L'interfaccia admin serve già per il 2026-10-02.

## Decisione
- Una sola serata attiva alla volta. "Termina e ricomincia" cancella partecipanti e
  conteggi; la lista delle azioni resta come punto di partenza per la festa successiva.
- Si entra come admin iscrivendosi con credenziali fisse: nickname `Administrator`, nome
  reale `admin` (maiuscole e spazi ignorati). Il nickname è riservato: nessun giocatore può
  usarlo.
- L'admin non è un giocatore: non ha contatori e non compare tra i partecipanti. Nel tipo
  `Session` è una variante distinta (`role: 'admin'`), così una sessione admin non può
  segnare azioni.
- L'admin può aggiungere azioni (descrizione + tipo, 0 punti), eliminarle (con i relativi
  conteggi) e azzerare la serata.
- Più persone possono essere admin nello stesso momento, entrando con le stesse credenziali.

## Motivazioni
Nessuna schermata di creazione della serata e nessuna gestione di link: è il minimo che
copre feste una dopo l'altra. Le credenziali fisse sono semplici da ricordare e condividere
tra gli organizzatori.

## Conseguenze negative
- Le credenziali sono deboli, e il repository è PUBBLICO: chi legge il codice o indovina
  "admin" può cancellare la serata. Con il backend reale le credenziali devono vivere solo
  sul server, fuori dal repository.
- Non si possono tenere due feste contemporaneamente.
- L'azzeramento non si può annullare.
- La "promozione di un altro utente ad admin", chiesta in precedenza, è sostituita dalla
  condivisione delle credenziali.

## Quando riaprirla
In caso di abusi, se servissero feste in parallelo o se servisse sapere quale admin ha fatto
cosa.
