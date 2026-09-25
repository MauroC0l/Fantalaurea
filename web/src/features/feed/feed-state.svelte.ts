import {
  SessionExpiredError,
  type ChangedTable,
  type GameBoard,
  type PhotoProcessor,
  type PlayerMoves,
  type WriteFailure,
} from '../../application/ports';
import { publishPost, type PublishError } from '../../application/social';
import { mergeFeed, withLike, type FeedItem, type Liker } from '../../domain/feed';
import type { PlayerSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

const RELEVANT: ReadonlySet<ChangedTable> = new Set(['posts', 'likes', 'player_completions', 'shared_completions', 'players']);

export interface FeedDependencies {
  readonly board: GameBoard;
  readonly moves: PlayerMoves;
  readonly photos: PhotoProcessor;
}

/** The evening's feed: newest first, more pages on demand, new items as they happen. */
export class FeedState {
  status = $state<LoadStatus>('loading');
  items = $state.raw<readonly FeedItem[]>([]);
  hasMore = $state(true);
  loadingMore = $state(false);

  readonly session: PlayerSession;
  readonly #deps: FeedDependencies;
  readonly #onSessionLost: () => void;
  #unsubscribe: (() => void) | null = null;

  constructor(deps: FeedDependencies, session: PlayerSession, onSessionLost: () => void) {
    this.#deps = deps;
    this.session = session;
    this.#onSessionLost = onSessionLost;
  }

  async start(): Promise<void> {
    try {
      await this.#loadNewest();
      this.status = 'ready';
      this.#unsubscribe ??= this.#deps.board.onChange((table) => {
        if (RELEVANT.has(table)) void this.#refresh();
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async loadMore(): Promise<void> {
    const oldest = this.items.at(-1);
    if (!this.hasMore || this.loadingMore || !oldest) return;
    this.loadingMore = true;
    try {
      const page = await this.#deps.board.feed(this.session, oldest.createdAt);
      this.hasMore = page.length > 0;
      this.items = mergeFeed(this.items, page);
    } catch (error) {
      this.#fail(error);
    } finally {
      this.loadingMore = false;
    }
  }

  /** Optimistic: the heart changes at once and goes back if the backend refuses. */
  async toggleLike(item: FeedItem): Promise<Result<{ liked: boolean }, WriteFailure>> {
    this.#replace(withLike(item, !item.likes.likedByMe));
    const result = await this.#deps.moves.toggleLike(this.session, item.id);
    if (!result.ok) {
      this.#replace(item);
      if (result.error === 'unauthorized') this.#onSessionLost();
    }
    return result;
  }

  /** Double tap only adds a like, as on Instagram. */
  async like(item: FeedItem): Promise<void> {
    if (!item.likes.likedByMe) await this.toggleLike(item);
  }

  likers(item: FeedItem): Promise<readonly Liker[]> {
    return this.#deps.board.likers(this.session, item.id);
  }

  async publish(file: File, caption: string): Promise<Result<void, PublishError>> {
    const result = await publishPost(this.#deps, this.session, file, caption);
    if (result.ok) await this.#refresh();
    return result;
  }

  async deletePost(item: FeedItem): Promise<Result<void, WriteFailure>> {
    const result = await this.#deps.moves.deletePost(this.session, item.id);
    if (result.ok) this.items = this.items.filter((i) => i.id !== item.id);
    return result;
  }

  async #refresh(): Promise<void> {
    try {
      await this.#loadNewest();
    } catch (error) {
      this.#fail(error);
    }
  }

  /** Reloads the first page; items that disappeared from it (undone, deleted) go away too. */
  async #loadNewest(): Promise<void> {
    const page = await this.#deps.board.feed(this.session, null);
    const oldestInPage = page.at(-1)?.createdAt.getTime() ?? -Infinity;
    const olderPages = this.items.filter((item) => item.createdAt.getTime() < oldestInPage);
    this.items = mergeFeed(olderPages, page);
  }

  #replace(item: FeedItem): void {
    this.items = this.items.map((i) => (i.id === item.id ? item : i));
  }

  #fail(error: unknown): void {
    if (error instanceof SessionExpiredError) this.#onSessionLost();
    else if (this.status === 'loading') this.status = 'failed';
  }
}
