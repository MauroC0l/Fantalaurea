# ADR 0011 — Serata chiusa: parola segreta e letture solo con token

Data: 2026-09-25 · Stato: accettata (decisione dell'utente) · Modifica ADR 0002 e 0003

## Contesto
Con profili, bio e una bacheca di foto visibile a tutti i partecipanti, i dati della serata
non devono essere leggibili da chi ha solo l'indirizzo del sito. Finora le tabelle
(giocatori, azioni fatte) erano leggibili con la chiave pubblica.

## Decisione
- Per entrare in una serata serve la **parola segreta**. È generata in automatico (due parole
  a tema laurea + un numero, es. `spritz-toga-47`) alla creazione e a ogni "Termina e
  ricomincia". L'admin la vede, la copia, la condivide e la cambia. Quando la cambia sceglie
  se far uscire chi è già dentro oppure lasciarlo dentro.
- Il confronto ignora maiuscole, spazi e trattini.
- L'admin entra con le sue credenziali senza parola (altrimenti non potrebbe leggerla).
  Ogni suo accesso finisce nel **log accessi admin**, visibile nel pannello e cancellato a
  ogni nuova serata.
- **Nessuna tabella è più leggibile dai client**: tutte le letture passano da funzioni che
  vogliono un token valido.
- Il tempo reale non trasporta più dati. I trigger del database mandano sul canale pubblico
  `fantalaurea` solo il segnale "è cambiata la tabella X", e i client rileggono con il loro
  token.
- Nuovo nickname con un nome reale già presente: l'app chiede "Sei tu?". Se sì, il vecchio
  profilo prende il nuovo nickname e tiene tutto; se no, nasce un profilo nuovo.

## Conseguenze negative
- Le credenziali admin restano quelle pubbliche nel repository (ADR 0006): chi le conosce
  entra, vede la parola e l'album. Il log serve ad accorgersene.
- La parola è indovinabile con molti tentativi (24 × 24 × 90, circa 52.000 combinazioni) e non c'è un
  limite ai tentativi. Accettato per una festa tra amici.
- Chi conosce il nome reale di qualcuno e la parola può prendersi il suo profilo con un
  nuovo nickname.
- Ogni lettura costa una verifica del token; il segnale di tempo reale fa rileggere tutti i
  client a ogni cambiamento (mitigato raggruppando i segnali).

## Quando riaprirla
In caso di abusi, o se l'app venisse usata oltre il gruppo di amici (servirebbero Supabase
Auth e limiti ai tentativi).
