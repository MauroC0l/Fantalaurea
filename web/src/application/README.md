# application

Use case dell'app e interfacce (porte) verso ciò che sta fuori: backend, memoria del
browser, vibrazione.

## API pubblica
- `ports.ts`:
  - `PlayerAccounts`: `join` (iscrizione o rientro con nickname + nome), `resume` (da token);
  - `GameBoard`: `catalog`, `countsOf`, `setCount` (valore assoluto, non +1: una richiesta
    ripetuta non conta due volte), `participants`, `onChange` (notifiche in tempo reale);
  - `SessionStore`: dove si conserva il token;
  - `Haptics`: vibrazione.

  Le letture rifiutano la Promise se il backend non risponde; le scritture restituiscono un
  `Result` con il motivo del fallimento.
- `join-game.ts`: `joinGame` valida l'identità, chiama il backend e salva il token.
- `resume-session.ts`: `resumeSession` distingue "rientrato", "da iscrivere" e "offline"
  (offline il token si conserva).

## Relazioni
- Dipende da: `domain/`.
- Usato da: `features/` (use case e porte), `app/` (composizione).
- Implementato da: `infrastructure/`.
- Dati posseduti: nessuno.
