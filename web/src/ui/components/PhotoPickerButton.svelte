<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from './Button.svelte';

  interface Props {
    variant?: 'primary' | 'ghost';
    size?: 'regular' | 'small';
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    onpick: (file: File) => void;
    children: Snippet;
  }

  let { variant = 'primary', size = 'regular', block = false, loading = false, disabled = false, onpick, children }: Props = $props();

  let input = $state<HTMLInputElement>();

  function picked() {
    const file = input?.files?.[0];
    // Reset so that picking the same photo again still fires a change.
    if (input) input.value = '';
    if (file) onpick(file);
  }
</script>

<!-- The native input stays hidden: only the OS picker (camera / gallery) is system UI. -->
<input bind:this={input} type="file" accept="image/*" hidden onchange={picked} />
<Button {variant} {size} {block} {loading} {disabled} onclick={() => input?.click()}>
  {@render children()}
</Button>
