import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { CHANGED_TABLES, type ChangedTable } from '../../application/ports';

const CHANNEL = 'fantalaurea';

export interface ChangeSignalsOptions {
  /** Many changes at once produce many signals: listeners hear about them once, after a pause. */
  readonly notifyDebounceMs: number;
}

/**
 * "Table X changed" between phones (ADR 0013): shared by every adapter that writes, so that one
 * channel carries all the signals. Signals carry no data: screens read again with their token.
 */
export class ChangeSignals {
  readonly #client: SupabaseClient;
  readonly #options: ChangeSignalsOptions;
  readonly #listeners = new Set<(table: ChangedTable) => void>();
  readonly #pendingTables = new Set<ChangedTable>();
  #channel: RealtimeChannel | null = null;
  #sender: RealtimeChannel | null = null;
  #notifyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(client: SupabaseClient, options: ChangeSignalsOptions) {
    this.#client = client;
    this.#options = options;
  }

  onChange(listener: (table: ChangedTable) => void): () => void {
    this.#listeners.add(listener);
    this.#ensureSubscribed();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#unsubscribe();
    };
  }

  /**
   * Tells every phone which tables changed, this one included: a broadcast does not come back to
   * its sender. Without a joined channel the announcement goes over HTTP.
   */
  announce(tables: readonly ChangedTable[]): void {
    for (const table of tables) this.#notifySoon(table);
    const channel = this.#channel ?? (this.#sender ??= this.#client.channel(CHANNEL));
    for (const table of tables) {
      const payload = { table };
      const sent =
        channel.state === 'joined'
          ? channel.send({ type: 'broadcast', event: 'changed', payload })
          : channel.httpSend('changed', payload);
      // A lost signal is recovered by the next one or when a phone comes back to the foreground.
      void sent.catch(() => {});
    }
  }

  #ensureSubscribed(): void {
    if (this.#channel) return;
    const channel = this.#client
      .channel(CHANNEL)
      .on('broadcast', { event: 'changed' }, ({ payload }) => this.#notifySoon((payload as { table: ChangedTable }).table));
    // A phone waking up may have missed signals while the connection was asleep.
    channel.subscribe((status) => status === 'SUBSCRIBED' && this.#notifyEverything());
    document.addEventListener('visibilitychange', this.#onVisible);
    this.#channel = channel;
  }

  #unsubscribe(): void {
    document.removeEventListener('visibilitychange', this.#onVisible);
    if (this.#channel) void this.#client.removeChannel(this.#channel);
    this.#channel = null;
  }

  readonly #onVisible = () => {
    if (document.visibilityState === 'visible') this.#notifyEverything();
  };

  #notifyEverything(): void {
    for (const table of CHANGED_TABLES) this.#notifySoon(table);
  }

  #notifySoon(table: ChangedTable): void {
    this.#pendingTables.add(table);
    clearTimeout(this.#notifyTimer);
    this.#notifyTimer = setTimeout(() => {
      const tables = [...this.#pendingTables];
      this.#pendingTables.clear();
      for (const listener of this.#listeners) for (const changed of tables) listener(changed);
    }, this.#options.notifyDebounceMs);
  }
}
