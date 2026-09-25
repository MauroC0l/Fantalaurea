export type Route =
  | { readonly name: 'regole' }
  | { readonly name: 'parola' }
  | { readonly name: 'iscrizione' }
  | { readonly name: 'bacheca' }
  | { readonly name: 'azioni' }
  | { readonly name: 'classifica' }
  | { readonly name: 'profilo' }
  | { readonly name: 'giocatore'; readonly id: string }
  | { readonly name: 'chat' }
  | { readonly name: 'conversazione'; readonly id: string }
  | { readonly name: 'admin' }
  | { readonly name: 'album' }
  | { readonly name: 'serata' };

export type RouteName = Route['name'];

export const SIMPLE_ROUTES: readonly RouteName[] = [
  'regole',
  'parola',
  'iscrizione',
  'bacheca',
  'azioni',
  'classifica',
  'profilo',
  'chat',
  'admin',
  'album',
  'serata',
];

/** Where the app lives, e.g. "/Fantalaurea/" on GitHub Pages (vite.config.ts, BASE_PATH). */
export const BASE_PATH: string = import.meta.env.BASE_URL;

/** Screens link with hrefs; app/router.svelte.ts turns the URL back into a Route. */
export function hrefTo(route: Route): string {
  return BASE_PATH + ('id' in route ? `${route.name}/${route.id}` : route.name);
}

