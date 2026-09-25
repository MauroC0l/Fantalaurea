<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Any CSS length, e.g. "45dvh" or "320px". */
    maxHeight: string;
    label?: string;
    children: Snippet;
  }

  let { maxHeight, label, children }: Props = $props();

  const viewportId = $props.id();

  const THUMB_MIN_PX = 28;

  let viewport = $state<HTMLElement>();
  let content = $state<HTMLElement>();
  let metrics = $state({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
  let dragging: { startY: number; startTop: number } | null = null;

  const scrollable = $derived(metrics.scrollHeight > metrics.clientHeight + 1);
  const thumbHeight = $derived(
    scrollable ? Math.max(THUMB_MIN_PX, (metrics.clientHeight / metrics.scrollHeight) * metrics.clientHeight) : 0,
  );
  const thumbTop = $derived(
    scrollable
      ? (metrics.scrollTop / (metrics.scrollHeight - metrics.clientHeight)) * (metrics.clientHeight - thumbHeight)
      : 0,
  );
  const atTop = $derived(metrics.scrollTop <= 1);
  const atBottom = $derived(metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - 1);

  function measure() {
    if (!viewport) return;
    metrics = { scrollTop: viewport.scrollTop, scrollHeight: viewport.scrollHeight, clientHeight: viewport.clientHeight };
  }

  // Content that grows or shrinks (items loaded, removed) changes the thumb too.
  $effect(() => {
    if (!viewport || !content) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  });

  function grab(event: PointerEvent) {
    if (!viewport) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = { startY: event.clientY, startTop: viewport.scrollTop };
  }

  function drag(event: PointerEvent) {
    if (!dragging || !viewport) return;
    const ratio = (metrics.scrollHeight - metrics.clientHeight) / (metrics.clientHeight - thumbHeight);
    viewport.scrollTop = dragging.startTop + (event.clientY - dragging.startY) * ratio;
  }
</script>

<!-- The native scrollbar is hidden everywhere (iOS ignores any styling of it): ours is drawn. -->
<div class="area" class:fade-top={scrollable && !atTop} class:fade-bottom={scrollable && !atBottom}>
  <div class="viewport" style:max-height={maxHeight} bind:this={viewport} onscroll={measure} id={viewportId} role="region" aria-label={label}>
    <div bind:this={content}>{@render children()}</div>
  </div>
  {#if scrollable}
    <div class="rail">
      <span
        class="thumb"
        role="scrollbar"
        aria-controls={viewportId}
        aria-orientation="vertical"
        aria-valuenow={Math.round((metrics.scrollTop / Math.max(1, metrics.scrollHeight - metrics.clientHeight)) * 100)}
        tabindex="-1"
        style:height="{thumbHeight}px"
        style:translate="0 {thumbTop}px"
        onpointerdown={grab}
        onpointermove={drag}
        onpointerup={() => (dragging = null)}
        onpointercancel={() => (dragging = null)}
      ></span>
    </div>
  {/if}
</div>

<style>
  .area {
    --fade: 24px;
    position: relative;
  }

  .viewport {
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    padding-right: var(--space-3);
  }

  .viewport::-webkit-scrollbar {
    display: none;
  }

  /* Soft edges say "there is more" without a word. */
  .fade-top .viewport {
    mask-image: linear-gradient(to bottom, transparent, #000 var(--fade));
  }

  .fade-bottom .viewport {
    mask-image: linear-gradient(to top, transparent, #000 var(--fade));
  }

  .fade-top.fade-bottom .viewport {
    mask-image: linear-gradient(to bottom, transparent, #000 var(--fade), #000 calc(100% - var(--fade)), transparent);
  }

  .rail {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
  }

  .thumb {
    position: absolute;
    top: 0;
    left: -3px;
    width: 10px;
    border-radius: var(--radius-pill);
    background: linear-gradient(var(--color-accent-1), var(--color-accent-2));
    background-clip: content-box;
    border: 3px solid transparent;
    cursor: grab;
    touch-action: none;
  }
</style>
