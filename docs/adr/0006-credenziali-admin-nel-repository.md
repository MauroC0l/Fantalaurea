# ADR 0006 — Credenziali admin pubbliche nel repository

Data: 2026-09-24 · Stato: accettata (decisione dell'utente) · Precisa l'ADR 0005

## Contesto
L'ADR 0005 raccomandava di tenere le credenziali admin solo sul server, fuori dal repository
pubblico. L'utente ha deciso diversamente: "è un'app banale, possiamo lasciare
Administrator / admin".

## Decisione
Le credenziali `Administrator` / `admin` sono inserite dalla migrazione
`supabase/migrations/20260924000000_schema.sql`, quindi visibili a chiunque legga il repo.
Stanno comunque nella tabella `admin_credentials`, che i client non possono leggere, e si
possono cambiare in qualsiasi momento dalla dashboard di Supabase senza toccare il codice.

## Motivazioni
Semplicità: gli organizzatori le ricordano e le condividono senza passaggi in più. Il danno
massimo è l'azzeramento di una festa tra amici.

## Conseguenze negative
Chiunque trovi il repo, o provi "admin", può modificare la lista delle azioni e cancellare
la serata in corso.

## Quando riaprirla
Al primo abuso: si cambia il valore in `admin_credentials` dalla dashboard, senza deploy.
