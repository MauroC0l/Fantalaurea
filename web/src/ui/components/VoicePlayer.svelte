<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    src: string | undefined;
    durationMs: number;
    /** Any stable text (e.g. the message id): the same voice note always draws the same wave. */
    seed: string;
    /** On my own (dark gradient) bubble: light controls. */
    inverted?: boolean;
  }

  let { src, durationMs, seed, inverted = false }: Props = $props();

  const BARS = 28;

  // The native <audio> is never shown: only its playback engine is used.
  const audio = typeof Audio === 'undefined' ? null : new Audio();
  let playing = $state(false);
  let position = $state(0);

  const total = $derived(durationMs / 1000);
  const progress = $derived(total > 0 ? Math.min(1, position / total) : 0);
  const heights = $derived(waveOf(seed));

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

  async function seek(event: MouseEvent) {
    if (!audio || !src) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    if (audio.src !== src) audio.src = src;
    audio.currentTime = ratio * total;
    position = audio.currentTime;
    if (!playing) await toggle();
  }

  /** Not the real waveform (that would mean decoding the audio): a pleasant, stable shape. */
  function waveOf(text: string): number[] {
    let hash = 2166136261;
    for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return Array.from({ length: BARS }, (_, i) => {
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const random = ((hash >>> 0) % 1000) / 1000;
      const envelope = Math.sin((Math.PI * (i + 1)) / (BARS + 1));
      return 0.25 + 0.75 * random * (0.45 + 0.55 * envelope);
    });
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
  <span class="body">
    <button class="wave" onclick={seek} disabled={!src} aria-label="Vai a un punto del vocale" tabindex="-1">
      {#each heights as height, i (i)}
        <span class="bar" class:played={(i + 0.5) / BARS <= progress} style:--h={height}></span>
      {/each}
    </button>
    <span class="time">{format(playing || position > 0 ? position : total)}</span>
  </span>
</span>

<style>
  .player {
    --ink: var(--color-text);
    --rail: rgb(255 255 255 / 0.28);
    --button: var(--color-accent-2);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 210px;
    padding: 2px 0;
  }

  .inverted {
    --ink: var(--color-on-bubble-mine);
    --rail: rgb(255 255 255 / 0.4);
    --button: var(--color-on-bubble-mine);
  }

  .play {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--button);
    color: var(--color-bg);
    transition: transform var(--duration-fast) var(--ease-spring);
  }

  .inverted .play {
    color: #8141d6;
  }

  .play:active {
    transform: scale(0.9);
  }

  .play:disabled {
    opacity: 0.5;
  }

  .body {
    flex: 1;
    display: grid;
    gap: 2px;
  }

  .wave {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 26px;
  }

  .bar {
    flex: 1;
    height: calc(var(--h) * 100%);
    min-height: 3px;
    border-radius: var(--radius-pill);
    background: var(--rail);
    transition: background var(--duration-fast) linear;
  }

  .bar.played {
    background: var(--ink);
  }

  .time {
    color: var(--ink);
    font-size: 11px;
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
    opacity: 0.8;
  }
</style>
