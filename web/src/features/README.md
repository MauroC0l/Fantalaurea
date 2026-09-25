# features

Le schermate e il loro stato.

## Ingresso
- `rules/RulesScreen`: regole; con `onjoin` è il benvenuto del primo accesso.
- `join/SecretWordScreen`: parola della serata (e link "Sei l'admin?").
- `join/JoinScreen`: nickname + nome vero; se il nome vero esiste già chiede "Sei tu?"
  (prendi il vecchio profilo / sono un'altra persona / annulla).

## Giocatore (tab Bacheca · Azioni · Classifica · Profilo)
- `feed/FeedScreen` + `FeedCard`, `PostComposerDialog`, `LikersDialog`,
  `feed-state.svelte.ts`: post e schede delle azioni, pagine infinite, doppio tocco per il like,
  cuore immediato (annullato se il server rifiuta), elenco di chi ha messo like, eliminazione
  dei propri post, aggiornamento in tempo reale.
- `actions/ActionsScreen` (+ `ActionItem`, `CompletedItem`, `PhotoConfirmDialog`): punti,
  avanzamento, filtri per tipo e difficoltà, completamento con o senza foto, annulla,
  elimina foto.
- `participants/ParticipantsScreen`: classifica per punti; ogni riga apre il profilo.
- `profile/ProfileScreen` + `BioEditorDialog`, `profile-state.svelte.ts`: foto profilo,
  nickname, nome vero, punti, posizione, bio, foto, azioni completate. Sul proprio profilo:
  cambia/togli foto, modifica bio, regole, esci.
- `game/game-state.svelte.ts`: catalogo, completamenti, classifica; `SessionExpiredError` →
  `onSessionLost`.
- `photos/photo-links.svelte.ts`: `PhotoLinksCache`, i link delle foto come stato reattivo;
  le richieste fatte durante un rendering partono insieme.

## Admin (tab Azioni · Album · Serata)
- `admin/AdminActionsScreen` + `ActionEditorDialog`: lista, crea, modifica, elimina azioni.
- `admin/AlbumScreen` + `album-state.svelte.ts`: tutte le foto (azioni e post), condividi,
  ZIP, elimina (moderazione).
- `admin/EveningScreen`: parola della serata (condividi, copia, cambia: chi è dentro resta o
  esce), log accessi admin, "Termina e ricomincia" con promemoria delle foto.
- `admin/admin-state.svelte.ts`: catalogo, partecipanti, parola e log in tempo reale.

## Condivisi
- `routes.ts`: i percorsi (`Route`, `hrefTo`), usati dai link e dal router di `app/`.
- `labels.ts`: etichette, formato dell'ora, "5 min fa", nome leggibile del dispositivo.

## Relazioni
- Dipende da: `application/`, `domain/`, `ui/`.
- Usato da: `app/` (`App.svelte`).
- Ascolta: `GameBoard.onChange`.
- Dati posseduti: stato in memoria di partita, bacheca, profili, pannello e album.
