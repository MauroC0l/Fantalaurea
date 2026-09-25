import { SvelteMap } from 'svelte/reactivity';
import { SessionExpiredError, type PhotoLinkProvider, type PhotoLinks } from '../../application/ports';
import type { Session } from '../../domain/player';

/**
 * Reactive photo links for the whole app. Screens just ask `get(id)`: ids requested while a
 * screen renders are sent together, once, and the links appear when they arrive.
 */
export class PhotoLinksCache {
  readonly #links = new SvelteMap<string, PhotoLinks>();
  readonly #requested = new Set<string>();
  readonly #queue = new Set<string>();
  readonly #provider: PhotoLinkProvider;
  readonly #session: Session;
  readonly #onExpired: () => void;
  #scheduled = false;

  constructor(provider: PhotoLinkProvider, session: Session, onExpired: () => void) {
    this.#provider = provider;
    this.#session = session;
    this.#onExpired = onExpired;
  }

  get(photoId: string | null | undefined): PhotoLinks | undefined {
    if (!photoId) return undefined;
    const links = this.#links.get(photoId);
    if (!links && !this.#requested.has(photoId)) {
      this.#requested.add(photoId);
      this.#queue.add(photoId);
      this.#schedule();
    }
    return links;
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => void this.#flush());
  }

  async #flush(): Promise<void> {
    this.#scheduled = false;
    const ids = [...this.#queue];
    this.#queue.clear();
    try {
      const links = await this.#provider.links(this.#session, ids);
      for (const [id, photo] of links) this.#links.set(id, photo);
    } catch (error) {
      // Let a later render ask again.
      for (const id of ids) this.#requested.delete(id);
      if (error instanceof SessionExpiredError) this.#onExpired();
    }
  }
}
