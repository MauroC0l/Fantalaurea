import { SvelteSet } from 'svelte/reactivity';
import type { Chat } from '../../application/ports';
import { TYPING_SHOWN_MS } from '../../domain/chat';
import type { PlayerSession } from '../../domain/player';

/** Which conversations are showing "sta scrivendo…": each signal keeps it on for a few seconds. */
export class TypingTracker {
  readonly #typing = new SvelteSet<string>();
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #unsubscribe: (() => void) | null = null;

  start(chat: Chat, session: PlayerSession): void {
    this.#unsubscribe ??= chat.onTyping(session, (conversationId) => this.#show(conversationId));
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#typing.clear();
  }

  isTyping(conversationId: string): boolean {
    return this.#typing.has(conversationId);
  }

  /** The message arrived: whoever was typing has finished. */
  settle(conversationId: string): void {
    clearTimeout(this.#timers.get(conversationId));
    this.#timers.delete(conversationId);
    this.#typing.delete(conversationId);
  }

  #show(conversationId: string): void {
    clearTimeout(this.#timers.get(conversationId));
    this.#typing.add(conversationId);
    this.#timers.set(conversationId, setTimeout(() => this.settle(conversationId), TYPING_SHOWN_MS));
  }
}
