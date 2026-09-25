<script lang="ts">
  import type { Snippet } from 'svelte';
  import ActionSheet from './ActionSheet.svelte';
  import Button from './Button.svelte';

  interface Props {
    variant?: 'primary' | 'ghost';
    size?: 'regular' | 'small';
    block?: boolean;
    loading?: boolean;
    disabled?: boolean;
    /** Needed when the button shows only an icon. */
    label?: string;
    onpick: (file: File) => void;
    children: Snippet;
  }

  let { variant = 'primary', size = 'regular', block = false, loading = false, disabled = false, label, onpick, children }: Props = $props();

  let camera = $state<HTMLInputElement>();
  let gallery = $state<HTMLInputElement>();
  let choosing = $state(false);

  // Some Android phones (e.g. Xiaomi) open only the gallery unless the camera is asked for
  // explicitly: the choice is ours. A computer has no camera to offer.
  function open() {
    if (matchMedia('(pointer: fine)').matches) gallery?.click();
    else choosing = true;
  }

  function picked(input: HTMLInputElement | undefined) {
    const file = input?.files?.[0];
    // Reset so that picking the same photo again still fires a change.
    if (input) input.value = '';
    if (file) onpick(file);
  }
</script>

<!-- The native inputs stay hidden: only the OS camera and gallery are system UI. -->
<input bind:this={camera} type="file" accept="image/*" capture="environment" hidden onchange={() => picked(camera)} />
<input bind:this={gallery} type="file" accept="image/*" hidden onchange={() => picked(gallery)} />
<Button {variant} {size} {block} {loading} {disabled} aria-label={label} onclick={open}>
  {@render children()}
</Button>
<ActionSheet
  open={choosing}
  title="Aggiungi una foto"
  onclose={() => (choosing = false)}
  items={[
    { icon: 'camera', label: 'Scatta una foto', onselect: () => camera?.click() },
    { icon: 'image', label: 'Scegli dalla galleria', onselect: () => gallery?.click() },
  ]}
/>
