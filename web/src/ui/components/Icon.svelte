<script lang="ts">
  import { ICONS, type IconName } from '../icons';

  interface Props {
    name: IconName;
    size?: number;
    filled?: boolean;
  }

  let { name, size = 22, filled = false }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width="2.2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={ICONS[name]} />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
