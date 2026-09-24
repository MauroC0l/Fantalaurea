<script lang="ts">
  import { fade } from 'svelte/transition';
  import { duration } from '../theme/motion';

  interface Props {
    src: string;
    alt: string;
    onclick?: () => void;
  }

  let { src, alt, onclick }: Props = $props();

  let loaded = $state(false);
</script>

<button class="thumbnail" class:loaded {onclick} disabled={!onclick} aria-label={alt}>
  {#key src}
    <img {src} {alt} loading="lazy" decoding="async" onload={() => (loaded = true)} in:fade={{ duration: duration('base') }} />
  {/key}
</button>

<style>
  .thumbnail {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(100deg, var(--color-surface) 30%, var(--color-surface-strong) 50%, var(--color-surface) 70%);
    background-size: 300% 100%;
    animation: shimmer 1.4s linear infinite;
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .thumbnail:disabled {
    cursor: default;
  }

  .thumbnail:active:not(:disabled) {
    transform: scale(0.96);
  }

  .loaded {
    animation: none;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @keyframes shimmer {
    to {
      background-position: -150% 0;
    }
  }
</style>
