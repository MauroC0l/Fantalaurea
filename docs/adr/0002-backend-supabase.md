# ADR 0002 — Backend: Supabase (Postgres + funzioni RPC + Realtime) al posto di un server nostro

Data: 2026-09-23 · Stato: accettata (scelta delegata a Claude dall'utente)

## Contesto
I dati devono essere condivisi tra i telefoni di circa 50 persone, con aggiornamenti in tempo
reale (scelta dell'utente). L'hosting deve essere gratuito e affidabile per la serata; il
PC di casa è solo un ripiego.

## Decisione
Niente server scritto da noi. Si usa Supabase, piano gratuito:
- Postgres come database; schema e funzioni in `supabase/migrations/` (versionati in git);
- le scritture passano SOLO da funzioni RPC (`security definer`) che validano i dati; le
  tabelle non sono scrivibili direttamente (Row Level Security);
- Supabase Realtime notifica ai client ogni modifica ai contatori.

Il frontend accede a Supabase solo tramite un adapter in `infrastructure/`, che implementa
interfacce (porte) definite dal livello `application/`.

## Motivazioni
- Tempo reale già pronto, senza scrivere un server WebSocket/SSE.
- Nessun "letargo": i servizi gratuiti di hosting Node (es. Render) si addormentano dopo
  15 minuti di inattività e perdono i file su disco.
- Il limite gratuito (circa 200 connessioni realtime contemporanee) copre 50 persone.

Alternative scartate:
- Node + Fastify su Render + database esterno: due servizi da gestire, avvio lento dopo il
  letargo, SSE da scrivere a mano.
- PC di casa + Cloudflare Tunnel: se cadono la corrente o la connessione di casa, la serata
  è persa; l'URL cambia a ogni avvio senza un dominio proprio.

## Conseguenze negative
- La logica di validazione vive in SQL (funzioni Postgres), meno comoda da testare di
  TypeScript.
- Dipendenza da un fornitore esterno e dai suoi limiti gratuiti.
- Il piano gratuito METTE IN PAUSA il progetto dopo 7 giorni senza traffico: prima di ogni
  serata va controllato e, se serve, riattivato dalla dashboard.
- La chiave pubblica (anon key) è visibile nel codice del sito: la sicurezza dipende
  interamente da RLS e dalle funzioni RPC.

## Quando riaprirla
Se servissero logiche complesse lato server, se i limiti gratuiti non bastassero o se la
pausa per inattività diventasse un problema ricorrente.
