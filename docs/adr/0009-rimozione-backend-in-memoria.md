# ADR 0009 — Rimozione del backend in memoria

Data: 2026-09-24 · Stato: accettata (decisione dell'utente) · Supera in parte l'ADR 0004

## Contesto
`MemoryBackend` serviva a sviluppare prima che esistesse Supabase. Con foto, Edge Function e
completamenti, mantenerlo avrebbe voluto dire scrivere ogni funzione due volte.

## Decisione
Si elimina `MemoryBackend`. Lo sviluppo e le prove si fanno sullo stack Supabase locale
(Docker), che è identico alla produzione. Porte e livelli dell'ADR 0004 restano: i test degli
use case usano implementazioni finte scritte nei test.

## Motivazioni
YAGNI: una seconda implementazione completa che nessuno usa in produzione è solo costo.

## Conseguenze negative
- Per sviluppare serve Docker acceso, e il primo avvio scarica qualche GB di immagini.
- Senza configurazione Supabase l'app non parte.

## Quando riaprirla
Se servisse una demo che funzioni senza alcun backend.
