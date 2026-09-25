export type Route =
  | { readonly name: 'regole' }
  | { readonly name: 'parola' }
  | { readonly name: 'iscrizione' }
  | { readonly name: 'bacheca' }
  | { readonly name: 'azioni' }
  | { readonly name: 'classifica' }
  | { readonly name: 'profilo' }
  | { readonly name: 'giocatore'; readonly id: string }
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
  'admin',
  'album',
  'serata',
];

/** Screens link with hrefs; app/router.svelte.ts turns the URL back into a Route. */
export function hrefTo(route: Route): string {
  return route.name === 'giocatore' ? `#/giocatore/${route.id}` : `#/${route.name}`;
}

