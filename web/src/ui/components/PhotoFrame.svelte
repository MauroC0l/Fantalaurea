<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    src: string | undefined;
    alt: string;
    /** Double tap, as on Instagram. */
    ondoubletap?: () => void;
    onopen?: () => void;
  }

  let { src, alt, ondoubletap, onopen }: Props = $props();

  const DOUBLE_TAP_MS = 300;
  const HEART_LIFETIME_MS = 900;

  let loaded = $state(false);
  let hearts = $state<number[]>([]);
  let lastTap = 0;
  let nextHeart = 0;
  let openTimer: ReturnType<typeof setTimeout> | undefined;

  function tap() {
    const now = Date.now();
    if (now - lastTap < DOUBLE_TAP_MS) {
      clearTimeout(openTimer);
      lastTap = 0;
      ondoubletap?.();
      const id = nextHeart++;
      hearts.push(id);
      setTimeout(() => (hearts = hearts.filter((heart) => heart !== id)), HEART_LIFETIME_MS);
      return;
    }
    lastTap = now;
    // Wait: a second tap would make this a like, not an open.
    openTimer = setTimeout(() => onopen?.(), DOUBLE_TAP_MS);
  }
</script>

<button class="frame" class:loaded onclick={tap} aria-label={alt}>
  {#if src}
    <img {src} {alt} loading="lazy" decoding="async" onload={() => (loaded = true)} />
  {/if}
  {#each hearts as id (id)}
    <span class="heart" aria-hidden="true"><Icon name="heart" size={96} filled /></span>
  {/each}
</button>

<style>
  .frame {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: linear-gradient(100deg, var(--color-surface) 30%, var(--color-surface-strong) 50%, var(--color-surface) 70%);
    background-size: 300% 100%;
    animation: shimmer 1.4s linear infinite;
    touch-action: manipulation;
  }

  .loaded {
    animation: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity var(--duration-base) var(--ease-out);
  }

  .loaded img {
    opacity: 1;
  }

  .heart {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--color-accent-1);
    filter: drop-shadow(0 6px 24px rgb(0 0 0 / 0.5));
    animation: like 900ms var(--ease-spring) forwards;
    pointer-events: none;
  }

  @keyframes like {
    0% {
      transform: scale(0.2);
      opacity: 0;
    }
    25% {
      transform: scale(1.15);
      opacity: 1;
    }
    60% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.3) translateY(-30px);
      opacity: 0;
    }
  }

  @keyframes shimmer {
    to {
      background-position: -150% 0;
    }
  }
</style>
