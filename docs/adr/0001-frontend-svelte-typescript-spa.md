# ADR 0001 — Frontend: SPA in Svelte 5 + TypeScript con Vite

Data: 2026-09-23 · Stato: accettata (scelta delegata a Claude dall'utente: "il più veloce da deployare")

## Contesto
App usata al 90% da telefono durante una festa, con grafica animata e componenti al 100%
personalizzati. Le regole del progetto chiedono tipi che rendano irrappresentabili gli stati
impossibili. Scadenza: festa del 2026-10-02.

## Decisione
Single Page Application statica: Svelte 5 + TypeScript, build con Vite. Routing via hash
(`#/regole`), così l'hosting statico non deve riscrivere gli URL.

## Motivazioni
- Una SPA statica si pubblica gratis ovunque (GitHub Pages, Cloudflare Pages), senza server.
- Svelte ha transizioni e animazioni integrate (`transition:`, `animate:`, spring/tweened):
  meno librerie per ottenere un'interfaccia animata.
- Bundle piccolo: carica in fretta su rete mobile scarsa, tipica di un locale.
- TypeScript per i tipi del dominio.

Alternative scartate:
- React: ecosistema più grande, ma animazioni solo con librerie esterne e bundle più pesante.
- HTML/JS senza framework: niente tipi, componenti riutilizzabili scomodi da mantenere.
- SvelteKit / Next.js: rendering lato server inutile per questa app, deploy più complesso.

## Conseguenze negative
- Svelte ha meno risorse, esempi e librerie di React.
- Con il routing via hash gli URL contengono `#`.
- Nessun rendering lato server: la prima visualizzazione aspetta il JavaScript.

## Quando riaprirla
Se servissero SEO o anteprime dei link generate lato server, o se il team che mantiene l'app
conoscesse solo React.
