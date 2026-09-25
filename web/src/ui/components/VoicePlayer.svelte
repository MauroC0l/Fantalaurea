<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    src: string | undefined;
    durationMs: number;
    /** On a coloured bubble: dark controls. */
    inverted?: boolean;
  }

  let { src, durationMs, inverted = false }: Props = $props();

  // The native <audio> is never shown: only its playback engine is used.
  const audio = typeof Audio === 'undefined' ? null : new Audio();
  let playing = $state(false);
  let position = $state(0);

  const total = $derived(durationMs / 1000);
  const progress = $derived(total > 0 ? Math.min(1, position / total) : 0);

  if (audio) {
    audio.preload = 'none';
    audio.addEventListener('timeupdate', () => (position = audio.currentTime));
    audio.addEventListener('ended', () => {
      playing = false;
      position = 0;
    });
    audio.addEventListener('pause', () => (playing = false));
    audio.addEventListener('play', () => (playing = true));
  }

  onDestroy(() => audio?.pause());

  async function toggle() {
    if (!audio || !src) return;
    if (playing) return audio.pause();
    if (audio.src !== src) audio.src = src;
    try {
      await audio.play();
    } catch {
      playing = false;
    }
  }

  function format(seconds: number): string {
    const whole = Math.max(0, Math.round(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }
</script>

<span class="player" class:inverted>
  <button class="play" onclick={toggle} disabled={!src} aria-label={playing ? 'Pausa' : 'Ascolta il vocale'}>
    <Icon name={playing ? 'pause' : 'play'} size={18} filled />
  </button>
  <span class="track" aria-hidden="true"><span class="fill" style:--progress={progress}></span></span>
  <span class="time">{format(playing || position > 0 ? position : total)}</span>
</span>

<style>
  .player {
    --ink: var(--color-text);
    --rail: var(--color-border-strong);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 200px;
  }

  .inverted {
    --ink: var(--color-on-accent);
    --rail: rgb(0 0 0 / 0.2);
  }

  .play {
    display: grid;
    place-items: center;
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--color-bg);
  }

  .inverted .play {
    color: var(--color-accent-2);
  }

  .play:disabled {
    opacity: 0.5;
  }

  .track {
    position: relative;
    flex: 1;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--rail);
    overflow: hidden;
  }

  .fill {
    position: absolute;
    inset: 0;
    background: var(--ink);
    transform: scaleX(var(--progress));
    transform-origin: left;
    transition: transform 200ms linear;
  }

  .time {
    color: var(--ink);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }
</style>
