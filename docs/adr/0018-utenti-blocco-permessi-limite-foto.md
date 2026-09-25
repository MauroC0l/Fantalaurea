# 0018 — Utenti: blocco, permessi, limite di 100 foto

Data: 2026-09-25 · Stato: accettata

## Contesto

L'utente vuole una schermata admin "Utenti". Dall'ADR 0011 le parole segrete fanno entrare
chiunque le conosca, quindi serve anche un modo per togliere qualcuno dalla serata.

Decisioni prese dall'utente il 2026-09-25:
- **Blocco:** chi è bloccato esce subito e non rientra, né con lo stesso nickname né con il suo
  nome vero. Post, foto e messaggi vengono nascosti, non cancellati. "Sblocca" rimette tutto.
- **Permessi per singolo utente:** "può creare sondaggi" e "può creare sfide" (le funzioni
  arrivano dopo).
- **Limite di 100 foto per utente:** contano le foto esistenti di azioni, post e chat, esclusa
  la foto profilo. Cancellarne una libera il posto.

## Decisione

- **`players`** riceve `blocked_at`, `can_create_polls` e `can_create_challenges`.
- **Bloccare** cancella le sessioni del giocatore: alla lettura successiva il suo telefono riceve
  403 ed esce. Da quel momento:
  - `join_game` risponde `blocked` se il nickname **o il nome vero** coincide con quello di un
    bloccato;
  - bacheca, classifica, profilo, "mi piace" (elenco e conteggio) e chat ignorano i suoi
    contenuti;
  - non gli si può aprire né scrivere una chat;
  - l'admin continua a vedere tutto (album, Utenti).
- **Permessi:** RPC `permissions(token)`, dove l'admin ha tutto. Il telefono la rilegge a ogni
  cambio della tabella `players`.
- **Limite di 100 foto:**
  - `photos_of` / `has_photo_room` nel database, controllati da ogni funzione che salva una foto
    (azione, post, foto in chat, inoltro di una foto a N chat, che vale N);
  - la Edge Function chiede `svc_photo_room` **prima** di caricare, così una foto rifiutata non
    costa il caricamento;
  - sostituire la foto di un'azione già fatta non conta;
  - errore `photo-limit`, con lo stesso messaggio ovunque (`PHOTO_LIMIT_MESSAGE`);
  - il proprio profilo mostra "Ne usi N di 100".

## Motivazioni

- **Nascondere invece di cancellare** rende il blocco reversibile: a una festa una decisione
  presa a caldo deve poter tornare indietro.
- **Il controllo sul nome vero** chiude la scappatoia più ovvia (rientrare con un nickname
  nuovo), senza pretendere di identificare le persone.
- **Contare le foto esistenti**, e non i caricamenti, fa sì che il limite protegga lo spazio
  occupato senza punire chi cancella e rifà.

## Conseguenze negative

- **Un bloccato può rientrare inventando nickname e nome vero.** Non c'è modo di impedirlo
  senza account veri.
- **Il blocco dura una serata:** "Termina e ricomincia" cancella i giocatori, bloccati compresi.
- **I contenuti nascosti occupano comunque spazio** fino al reset.
- **I suoi "mi piace" spariscono dai conteggi**, ma i suoi messaggi restano nelle chat degli
  altri, nascosti solo perché l'intera chat con lui non si vede più.
- **Due foto caricate nello stesso istante** possono superare il controllo preventivo. La
  funzione SQL le ferma comunque, ma il file della seconda viene caricato e poi tolto.

## Quando riaprirla

- Se servono blocchi che sopravvivono alle serate: richiederebbero un'identità stabile, cioè
  account.
- Se 100 foto risultano poche o troppe: la costante è in `has_photo_room` (SQL) e `PHOTO_LIMIT`
  (dominio).
