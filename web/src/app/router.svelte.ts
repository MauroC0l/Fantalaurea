import { tick } from 'svelte';
import { BASE_PATH, SIMPLE_ROUTES, hrefTo, type Route } from '../features/routes';

export { hrefTo, type Route } from '../features/routes';

interface EntryState {
  readonly scrollY: number;
  /** How many app pages come before this one: 0 = the first one opened. */
  readonly depth: number;
}

const RESTORE_ATTEMPTS_MS = [0, 120, 350, 800];

function parse(pathname: string): Route | null {
  if (!pathname.startsWith(BASE_PATH)) return null;
  const [name, id] = decodeURI(pathname.slice(BASE_PATH.length)).split('/');
  if ((name === 'giocatore' || name === 'conversazione') && id) return { name, id };
  return (SIMPLE_ROUTES as readonly string[]).includes(name) ? ({ name } as Route) : null;
}

/**
 * Real paths (/Fantalaurea/bacheca) with the History API (ADR 0017). Internal links stay plain
 * <a href>: a click on one is turned into a navigation without reloading the page.
 */
export class PathRouter {
  current = $state<Route | null>(null);

  constructor() {
    // Links shared before ADR 0017 still say "#/bacheca".
    if (location.hash.startsWith('#/')) history.replaceState(null, '', BASE_PATH + location.hash.slice(2));
    this.current = parse(location.pathname);
    if (!history.state) history.replaceState({ scrollY: 0, depth: 0 } satisfies EntryState, '');
    history.scrollRestoration = 'manual';
    addEventListener('popstate', (event) => {
      this.current = parse(location.pathname);
      void restoreScroll((event.state as EntryState | null)?.scrollY ?? 0);
    });
    document.addEventListener('click', (event) => this.#follow(event));
  }

  is(name: Route['name']): boolean {
    return this.current?.name === name;
  }

  /** replace: for redirects, so that "back" does not land on a page that redirects again. */
  go(route: Route, options: { replace?: boolean } = {}): void {
    this.#navigate(hrefTo(route), options.replace ?? false);
  }

  /** The browser's back when it stays inside the app, otherwise the given screen. */
  back(fallback: Route): void {
    if (this.#entry().depth > 0) history.back();
    else this.go(fallback, { replace: true });
  }

  #navigate(href: string, replace: boolean): void {
    if (href === location.pathname) return;
    const { depth } = this.#entry();
    if (replace) {
      history.replaceState({ scrollY: 0, depth } satisfies EntryState, '', href);
    } else {
      // Remember where the page was, so that "back" returns there.
      history.replaceState({ scrollY, depth } satisfies EntryState, '');
      history.pushState({ scrollY: 0, depth: depth + 1 } satisfies EntryState, '', href);
    }
    this.current = parse(location.pathname);
    scrollTo({ top: 0 });
  }

  #entry(): EntryState {
    return (history.state as EntryState | null) ?? { scrollY: 0, depth: 0 };
  }

  #follow(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest('a');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !parse(url.pathname)) return;
    event.preventDefault();
    this.#navigate(url.pathname, false);
  }
}

/** Lists may still be drawing: try again for a moment until the page is tall enough. */
async function restoreScroll(y: number): Promise<void> {
  await tick();
  for (const delay of RESTORE_ATTEMPTS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    scrollTo({ top: y });
    if (Math.abs(scrollY - y) < 2) return;
  }
}
