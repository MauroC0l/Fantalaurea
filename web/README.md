# web — l'app Fantalaurea

Single Page Application (Svelte 5 + TypeScript + Vite) usata dai giocatori sul telefono.
Scelte e motivazioni: [ADR 0001](../docs/adr/0001-frontend-svelte-typescript-spa.md),
[ADR 0002](../docs/adr/0002-backend-supabase.md), [ADR 0004](../docs/adr/0004-architettura-a-livelli.md).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo, raggiungibile anche dal telefono sulla stessa Wi-Fi (`http://<IP del PC>:5173`) |
| `npm test` | test automatici (Vitest) |
| `npm run test:db` | test d'integrazione contro il Supabase locale (lo azzera) |
| `npm run check` | controllo dei tipi (svelte-check + tsc) |
| `npm run build` | build statica in `dist/` |
| `npm run db:start` / `db:reset` / `db:stop` | database locale, vedi [supabase/](../supabase/README.md) |
| `npm run db:deploy` | carica migrazioni e funzione `photos` sul progetto di produzione |

## Backend usato
Sempre Supabase (ADR 0009), configurato da `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY`:
- `.env.development.local` (non versionato): stack locale, per `npm run dev` e per
  `vite build --mode development`;
- `.env.production`: progetto cloud, per `npm run build`.

Attenzione: Vite dà priorità a `.env.production` su `.env.local`, per questo il file locale
si chiama `.env.development.local`.

## Pubblicazione
Ogni push su `main` avvia [.github/workflows/deploy.yml](../.github/workflows/deploy.yml):
controllo tipi, test, build e pubblicazione su GitHub Pages.

## Livelli e dipendenze

```
app/  ──►  features/  ──►  application/  ──►  domain/
  │            │                ▲
  │            └──►  ui/        │ implementa le porte
  └──────────────────►  infrastructure/
```

Le frecce indicano "dipende da". `domain/` non dipende da niente; `application/` solo da
`domain/`; `infrastructure/` implementa le interfacce di `application/`; `app/` è l'unico
punto che sceglie le implementazioni concrete (composition root).

| Modulo | Responsabilità |
|---|---|
| [domain/](src/domain/README.md) | tipi e regole pure del gioco |
| [application/](src/application/README.md) | use case e porte verso l'esterno |
| [infrastructure/](src/infrastructure/README.md) | implementazioni delle porte (backend, browser) |
| [ui/](src/ui/README.md) | sistema di stili: tema e componenti |
| [features/](src/features/README.md) | le schermate e lo stato di gioco |
| [app/](src/app/README.md) | composizione, routing, guscio dell'app |
