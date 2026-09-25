# 0021 — Sfide ovunque, bacheca in due sezioni, durata libera, download guidato

Data: 2026-09-25 · Stato: accettata · Modifica: 0019 (chiusura dei sondaggi), 0020 (posto delle sfide)

## Contesto

Richieste dell'utente del 2026-09-25, dopo aver provato l'app:
- **Sfide a tempo:**
  - una sezione apposita;
  - le sfide compiute vanno nel profilo e tra le azioni completate;
  - si deve poter vedere chi le ha completate;
  - la durata si deve poter scegliere liberamente, con un selettore personalizzato.
- **Sondaggi:** per "chiusura automatica" intendeva "a tempo", non "quando hanno votato tutti"
  (l'interpretazione dell'ADR 0019).
- **Bacheca:** due sezioni distinte, una per le imprese e una per i post.
- **Album:** un solo tasto "scarica" con un pannello che spieghi quanti download verranno fatti
  e perché, invece di un tasto per ogni parte.
- **Regole:** riscritte dall'utente; le funzioni diventano "possibilità", non regole.

## Decisione

- **"A tempo" è un filtro della schermata Azioni,** accanto a Tutte / Bonus / Malus / Fatte,
  e non una scheda nuova: con 6 schede la barra è già piena.
  - Le sfide completate compaiono in cima a "Fatte" e nel contatore "X su N completate".
  - Il nome del filtro mostra quante sfide si possono ancora fare.
  - Azioni resta ignara delle sfide: riceve solo numeri e due segnaposti (`timed`).
- **Chi l'ha completata:**
  - la RPC `challenge_completers` restituisce tutti, in ordine, con la posizione e se hanno preso i
    punti;
  - si apre toccando "N l'hanno fatta".
- **Profilo:** `profile` restituisce anche le sfide. `deedsOf` le fonde con le azioni per data,
  con 0 punti per chi è arrivato dopo i primi N.
- **Bacheca:**
  - `feed(token, before, limit, section)` con `posts` o `deeds`, dove le imprese sono le azioni
    completate e le sfide vinte;
  - le sfide hanno un id per ricevere i "mi piace";
  - una sezione alla volta, caricata quando la scegli.
- **Durata libera:**
  - `DurationPicker`, un componente nuovo del sistema di stili con ore e minuti (a passi di 5),
    ciascuno con − e +;
  - si apre con la scelta "Personalizzata", per sfide (massimo 12 ore, anche lato server) e
    sondaggi (massimo 24 ore).
- **Sondaggi:** l'opzione "chiudi quando hanno votato tutti" sparisce dall'interfaccia. Il
  server la conserva, sempre falsa, per non cambiare il contratto della RPC.
- **Download guidato:**
  - "Scarica tutte" apre un pannello: spiega quanti ZIP da 100 foto verranno scaricati, e che
    tutte insieme farebbero chiudere la pagina;
  - poi li scarica da solo, uno dopo l'altro, rilasciando ogni parte dalla memoria prima della
    successiva, con 0,8 s di pausa tra un download e l'altro;
  - su iPhone resta "Salva nel rullino": un tocco per gruppo, perché la condivisione richiede
    sempre un tocco dell'utente.
- **Filtri delle Azioni:** su una riga scorrevole (`ChipGroup scroll`).

## Motivazioni

- **Un filtro, non una scheda:** le sfide sono azioni, e il loro posto naturale è accanto alle
  altre; lo spazio nella barra è finito.
- **Sezioni della bacheca lato server:** con due richieste separate ogni sezione ha la sua
  paginazione, e le imprese non spingono i post fuori dalla prima pagina.
- **Download in fila:** il browser non permette di scaricare più file in parallelo senza
  chiedere, e la memoria del telefono non regge tutto insieme.

## Conseguenze negative

- **Il primo download multiplo può essere bloccato** finché l'utente non accetta il permesso
  del browser (Chrome lo chiede una volta).
- **Su iPhone salvare nel rullino richiede un tocco per gruppo da 100.**
- **La colonna `close_when_all_voted` resta nel database senza uso.**
- **Una sfida vinta dopo i primi N compare in bacheca con i suoi punti,** anche se non li ha dati
  (il profilo mostra 0).

## Quando riaprirla

- Se la barra delle schede si libera, le sfide potrebbero avere una scheda propria.
- Se si passa a un hosting con file ZIP generati dal server: niente limiti di memoria sul
  telefono, e un solo download.
