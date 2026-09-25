<script lang="ts">
  import type { Snippet } from 'svelte';
  import { longpress } from '../actions/longpress';
  import Icon from './Icon.svelte';

  interface Props {
    mine: boolean;
    time: string;
    /** Consecutive messages of the same person hug each other; the group's ends are rounder. */
    groupStart?: boolean;
    groupEnd?: boolean;
    /** Photos sit edge to edge in the bubble, with the time over them. */
    media?: boolean;
    /** The player shows its own length on the left: the time shares that line. */
    voice?: boolean;
    deleted?: boolean;
    edited?: boolean;
    forwarded?: boolean;
    /** The message this one answers. */
    quote?: { author: string; text: string; onclick: () => void };
    /** Briefly lit up, e.g. after jumping to it from a reply. */
    highlighted?: boolean;
    onmenu?: () => void;
    /** Drag to the right, as on WhatsApp. */
    onreply?: () => void;
    children: Snippet;
  }

  let {
    mine,
    time,
    groupStart = true,
    groupEnd = true,
    media = false,
    voice = false,
    deleted = false,
    edited = false,
    forwarded = false,
    quote,
    highlighted = false,
    onmenu,
    onreply,
    children,
  }: Props = $props();

  const SWIPE_TRIGGER_PX = 56;
  const SWIPE_MAX_PX = 80;

  let drag = $state(0);
  let swipe: { x: number; y: number; horizontal: boolean | null } | null = null;

  function down(event: PointerEvent) {
    if (!onreply || event.pointerType === 'mouse') return;
    swipe = { x: event.clientX, y: event.clientY, horizontal: null };
  }

  function move(event: PointerEvent) {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    // Decide once whether the finger is scrolling the chat or dragging the bubble.
    if (swipe.horizontal === null && Math.hypot(dx, dy) > 8) swipe.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0;
    if (swipe.horizontal) drag = Math.min(Math.max(dx, 0), SWIPE_MAX_PX);
  }

  function up() {
    if (drag >= SWIPE_TRIGGER_PX) onreply?.();
    swipe = null;
    drag = 0;
  }
</script>

<div
  class="line"
  role="group"
  class:mine
  class:group-start={groupStart}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  <span class="reply-hint" style:opacity={drag / SWIPE_TRIGGER_PX} aria-hidden="true"><Icon name="reply" size={18} /></span>
  <div
    class="bubble"
    class:mine
    class:media
    class:voice
    class:deleted
    class:highlighted
    class:start={groupStart}
    class:end={groupEnd}
    class:dragging={drag > 0}
    style:translate="{drag}px 0"
    use:longpress={onmenu}
  >
    {#if forwarded && !deleted}
      <span class="forwarded"><Icon name="forward" size={12} /> Inoltrato</span>
    {/if}
    {#if quote && !deleted}
      <button class="quote" onclick={quote.onclick}>
        <span class="quote-author">{quote.author}</span>
        <span class="quote-text">{quote.text}</span>
      </button>
    {/if}
    <div class="content">
      {#if deleted}
        <span class="gone">{mine ? 'Hai eliminato questo messaggio' : 'Messaggio eliminato'}</span>
      {:else}
        {@render children()}
      {/if}
      <!-- Reserves room on the last line so the time never overlaps the text. -->
      <span class="spacer" aria-hidden="true">{edited ? 'modificato ' : ''}{time}</span>
    </div>
    <span class="meta">{edited && !deleted ? 'modificato · ' : ''}{time}</span>
  </div>
</div>

<style>
  .line {
    position: relative;
    display: flex;
    justify-content: flex-start;
    margin-top: 2px;
    touch-action: pan-y;
  }

  .line.group-start {
    margin-top: var(--space-3);
  }

  .line.mine {
    justify-content: flex-end;
  }

  .reply-hint {
    position: absolute;
    left: var(--space-1);
    top: 50%;
    translate: 0 -50%;
    color: var(--color-text-muted);
  }

  .bubble {
    --r: 18px;
    --r-join: 5px;
    --tl: var(--r);
    --tr: var(--r);
    --br: var(--r);
    --bl: var(--r);
    position: relative;
    display: grid;
    gap: var(--space-1);
    max-width: min(80%, 420px);
    padding: 7px var(--space-3) 7px;
    border-radius: var(--tl) var(--tr) var(--br) var(--bl);
    background: var(--color-bubble-in);
    border: 1px solid var(--color-bubble-in-border);
    color: var(--color-text);
    line-height: 1.35;
    -webkit-touch-callout: none;
    user-select: none;
    transition:
      translate var(--duration-base) var(--ease-out),
      box-shadow var(--duration-slow) var(--ease-out);
  }

  /* Only the corners facing a neighbour of the same group tighten. */
  .bubble:not(.mine):not(.start) {
    --tl: var(--r-join);
  }

  .bubble:not(.mine):not(.end) {
    --bl: var(--r-join);
  }

  .bubble.mine:not(.start) {
    --tr: var(--r-join);
  }

  .bubble.mine:not(.end) {
    --br: var(--r-join);
  }

  .bubble.mine {
    background: var(--gradient-bubble-mine);
    border-color: transparent;
    color: var(--color-on-bubble-mine);
  }

  .bubble.dragging {
    transition: none;
  }

  .bubble.highlighted {
    box-shadow: 0 0 0 3px var(--color-accent-3);
  }

  .bubble.media {
    padding: 3px;
  }

  .bubble.deleted {
    background: transparent;
    border: 1px dashed var(--color-border-strong);
    color: var(--color-text-subtle);
  }

  .forwarded {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-style: italic;
    opacity: 0.75;
  }

  .media .forwarded {
    padding: var(--space-1) var(--space-2) 0;
  }

  .quote {
    display: grid;
    gap: 1px;
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    border-left: 3px solid var(--color-accent-3);
    border-radius: var(--space-1) var(--radius-sm) var(--radius-sm) var(--space-1);
    background: rgb(0 0 0 / 0.22);
    text-align: left;
  }

  .quote-author {
    color: var(--color-accent-3);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
  }

  .mine .quote {
    border-left-color: var(--color-on-bubble-mine);
  }

  .mine .quote-author {
    color: var(--color-on-bubble-mine);
  }

  .quote-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: var(--text-sm);
    opacity: 0.85;
  }

  .content {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .gone {
    font-style: italic;
  }

  .spacer {
    display: inline-block;
    visibility: hidden;
    padding-left: var(--space-3);
    font-size: 11px;
    white-space: nowrap;
  }

  .media .spacer,
  .voice .spacer {
    display: none;
  }

  .meta {
    position: absolute;
    right: var(--space-3);
    bottom: 6px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0.72;
  }

  .media .meta {
    right: var(--space-2);
    bottom: var(--space-2);
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: rgb(0 0 0 / 0.5);
    color: #fff;
    opacity: 1;
  }
</style>
