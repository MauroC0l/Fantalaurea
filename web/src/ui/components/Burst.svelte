<script lang="ts">
  import type { Tone } from '../tone';

  let { tone, spread = 1 }: { tone: Tone; spread?: number } = $props();

  const PARTICLES = 18;
  const particles = $derived(
    Array.from({ length: PARTICLES }, (_, index) => ({
      angle: (360 / PARTICLES) * index + Math.random() * 18,
      distance: (30 + Math.random() * 26) * spread,
      size: (4 + Math.random() * 5) * Math.sqrt(spread),
      shade: index % 3,
    })),
  );
</script>

<span class="burst" data-tone={tone} aria-hidden="true">
  {#each particles as particle, index (index)}
    <i
      data-shade={particle.shade}
      style:--angle="{particle.angle}deg"
      style:--distance="{particle.distance}px"
      style:--size="{particle.size}px"
    ></i>
  {/each}
</span>

<style>
  .burst {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: var(--z-burst);
    pointer-events: none;
  }

  i {
    position: absolute;
    width: var(--size);
    height: var(--size);
    margin: calc(var(--size) / -2);
    border-radius: 2px;
    animation: fly var(--duration-slow) var(--ease-out) forwards;
  }

  [data-tone='bonus'] [data-shade='0'] {
    background: var(--color-bonus);
  }
  [data-tone='bonus'] [data-shade='1'] {
    background: var(--color-accent-3);
  }
  [data-tone='bonus'] [data-shade='2'] {
    background: var(--color-accent-1);
  }
  [data-tone='malus'] i {
    background: var(--color-malus);
  }
  [data-tone='malus'] [data-shade='1'] {
    background: var(--color-accent-2);
  }
  [data-tone='common'] i {
    background: var(--color-common);
  }
  [data-tone='common'] [data-shade='1'] {
    background: var(--color-accent-1);
  }

  @keyframes fly {
    from {
      opacity: 1;
      transform: rotate(var(--angle)) translateX(0) scale(1);
    }
    to {
      opacity: 0;
      transform: rotate(var(--angle)) translateX(var(--distance)) scale(0.3) rotate(180deg);
    }
  }
</style>
