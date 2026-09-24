<script lang="ts">
  let { name }: { name: string } = $props();

  const PALETTE_SIZE = 6;

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

<span class="avatar" style:--avatar="var(--avatar-{shade})" aria-hidden="true">{initials}</span>

<style>
  .avatar {
    display: grid;
    place-items: center;
    flex: none;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--avatar);
    color: var(--color-on-accent);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: var(--weight-black);
  }
</style>
