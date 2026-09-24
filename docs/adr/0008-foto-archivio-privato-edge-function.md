# ADR 0008 — Foto: archivio privato, Edge Function, compressione sul telefono

Data: 2026-09-24 · Stato: accettata (opzione A scelta dall'utente)

## Contesto
Alcune azioni accettano o richiedono una foto. Le foto le vedono solo chi le ha scattate e
l'admin (album). I nostri token non sono quelli di Supabase Auth, quindi le regole
dell'archivio Supabase (Storage) non possono sapere chi è admin.

## Decisione
- Bucket `photos` PRIVATO: nessun client può leggerlo o scriverci direttamente.
- Una Edge Function `photos` (codice in `supabase/functions/photos/`) gestisce tutto ciò che
  tocca i file: caricamento con completamento, annullamento, eliminazione foto, foto
  personali, album, eliminazione azione, azzeramento serata. Controlla il nostro token,
  chiama funzioni SQL riservate al `service_role` e restituisce link firmati validi un'ora.
- Le operazioni senza file (completare senza foto, modificare azioni) restano RPC.
- Sul telefono la foto viene ricodificata in JPEG: lato lungo massimo 2560 px, qualità 0,9,
  orientamento corretto. Si carica anche una miniatura da 480 px per le griglie.
- Ogni azione ha una politica foto: `none` | `optional` | `required`, scelta dall'admin.

## Motivazioni
- La privacy si garantisce sul server, non con indirizzi difficili da indovinare (opzione C
  scartata). Passare a Supabase Auth (opzione B) avrebbe rifatto l'identità a pochi giorni
  dalla festa.
- 2560 px sono circa 5 megapixel: indistinguibili dall'originale su telefono e sui social
  (Instagram si ferma a 1440 px). Il file pesa 1-2 MB invece di 4-8, e si evitano gli HEIC
  degli iPhone, illeggibili su molti browser.
- Le miniature evitano di scaricare centinaia di MB per aprire l'album.

## Conseguenze negative
- Un pezzo in più da pubblicare (`supabase functions deploy photos`) e da tenere allineato
  con lo schema.
- La foto caricata non è l'originale: niente dati EXIF (luogo, modello) e risoluzione
  massima di 2560 px.
- Piano gratuito: 1 GB di spazio (circa 600-1000 foto), liberato a ogni "Termina e
  ricomincia".
- Se si cancellano righe del database senza passare dalla funzione (es. dalla dashboard),
  i file restano orfani nel bucket.

## Quando riaprirla
Se servissero gli originali in piena risoluzione, o se si adottasse Supabase Auth.
