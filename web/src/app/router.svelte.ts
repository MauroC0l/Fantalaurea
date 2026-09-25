import { SIMPLE_ROUTES, hrefTo, type Route, type RouteName } from '../features/routes';

export { hrefTo, type Route } from '../features/routes';

function parse(hash: string): Route | null {
  const [name, id] = hash.replace(/^#\/?/, '').split('/');
  if ((name === 'giocatore' || name === 'conversazione') && id) return { name, id };
  return (SIMPLE_ROUTES as readonly string[]).includes(name) ? ({ name } as Route) : null;
}

/** Hash routing: static hosting serves index.html for every route without rewrites. */
export class HashRouter {
  current = $state<Route | null>(parse(location.hash));

  constructor() {
    // One document hosts every screen: without this, a new screen opens where the old one was scrolled.
    addEventListener('hashchange', () => {
      this.current = parse(location.hash);
      scrollTo({ top: 0 });
    });
  }

  is(name: RouteName): boolean {
    return this.current?.name === name;
  }

  go(route: Route): void {
    location.hash = hrefTo(route).slice(1);
  }
}
