export const ROUTES = ['regole', 'iscrizione', 'azioni', 'partecipanti', 'admin'] as const;

export type Route = (typeof ROUTES)[number];

export function hrefTo(route: Route): string {
  return `#/${route}`;
}

function parse(hash: string): Route | null {
  const candidate = hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(candidate) ? (candidate as Route) : null;
}

/** Hash routing: static hosting serves index.html for every route without rewrites. */
export class HashRouter {
  current = $state<Route | null>(parse(location.hash));

  constructor() {
    addEventListener('hashchange', () => (this.current = parse(location.hash)));
  }

  go(route: Route): void {
    location.hash = `/${route}`;
  }
}
