# ADR 0013 — I segnali di tempo reale partono dai client

Data: 2026-09-25 · Stato: accettata · Modifica l'ADR 0011 (solo il meccanismo del segnale)

## Contesto
L'ADR 0011 faceva partire il segnale "tabella X cambiata" da trigger del database
(`realtime.send` su un canale pubblico). In locale funziona. Sul Supabase ospitato i messaggi
vengono scritti in `realtime.messages` ma non arrivano ai client sui canali pubblici:
verificato il 2026-09-25 con una sonda. Il broadcast da client a client sullo stesso canale
invece funziona.

## Decisione
- Dopo ogni scrittura riuscita (iscrizione, azione, like, post, bio, foto profilo, azioni
  admin, parola, azzeramento) il client annuncia sul canale `fantalaurea` quali tabelle sono
  cambiate. Se non è collegato al canale, l'annuncio parte via HTTP.
- Lo stesso annuncio avvisa subito anche le schermate del telefono che ha scritto (il
  broadcast non torna a chi lo manda).
- Il segnale continua a non contenere dati: chi lo riceve rilegge con il proprio token.
- Trigger e funzione `notify_change` vengono rimossi dal database: un solo meccanismo.

## Motivazioni
Funziona sia in locale sia in produzione ed è verificabile. Canali privati con autorizzazione
richiederebbero token JWT, mentre le chiavi "publishable" non lo sono: molto più lavoro a pochi
giorni dalla festa.

## Conseguenze negative
- Le modifiche fatte a mano dalla dashboard di Supabase non avvisano nessuno: i telefoni si
  aggiornano al successivo segnale o quando tornano in primo piano.
- Chiunque conosca l'indirizzo può mandare segnali finti sul canale: non leggono né cambiano
  dati, ma possono far rileggere i telefoni inutilmente.
- Se un telefono perde la connessione subito dopo una scrittura, l'annuncio può andare perso
  (gli altri si allineano al segnale successivo).

## Quando riaprirla
Se servisse il tempo reale anche per modifiche fatte fuori dall'app, o se si passasse a
Supabase Auth (canali privati).
