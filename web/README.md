# web — l'app Fantalaurea

Single Page Application (Svelte 5 + TypeScript + Vite) usata dai giocatori sul telefono.
Scelte e motivazioni: [ADR 0001](../docs/adr/0001-frontend-svelte-typescript-spa.md),
[ADR 0002](../docs/adr/0002-backend-supabase.md), [ADR 0004](../docs/adr/0004-architettura-a-livelli.md).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo, raggiungibile anche dal telefono sulla stessa Wi-Fi (`http://<IP del PC>:5173`) |
| `npm test` | test automatici (Vitest) |
| `npm run check` | controllo dei tipi (svelte-check + tsc) |
| `npm run build` | build statica in `dist/` |

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
