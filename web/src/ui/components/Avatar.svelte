<script lang="ts">
  interface Props {
    name: string;
    /** A profile photo; the initials show until it loads, or when there is none. */
    src?: string;
    size?: 'sm' | 'md' | 'lg';
  }

  let { name, src, size = 'md' }: Props = $props();

  const PALETTE_SIZE = 6;

  let loaded = $state(false);

  const initials = $derived(
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => [...word][0]?.toLocaleUpperCase('it'))
      .join(''),
  );

  const shade = $derived(
    ([...name].reduce((hash, char) => (hash * 31 + char.codePointAt(0)!) >>> 0, 7) % PALETTE_SIZE) + 1,
  );
</script>

<span class="avatar" data-size={size} style:--avatar="var(--avatar-{shade})" aria-hidden="true">
  {#if !loaded}{initials}{/if}
  {#if src}
    <img {src} alt="" class:loaded onload={() => (loaded = true)} />
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--avatar);
    color: var(--color-on-accent);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: var(--weight-black);
  }

  [data-size='sm'] {
    width: 34px;
    height: 34px;
    font-size: var(--text-xs);
  }

  [data-size='lg'] {
    width: 104px;
    height: 104px;
    font-size: var(--text-xl);
    box-shadow: var(--shadow-glow);
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity var(--duration-base) var(--ease-out);
  }

  img.loaded {
    opacity: 1;
  }
</style>
