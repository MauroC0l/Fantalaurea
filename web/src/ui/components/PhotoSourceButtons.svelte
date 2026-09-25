<script lang="ts">
  import Icon from './Icon.svelte';
  import PhotoPickerButton from './PhotoPickerButton.svelte';

  interface Props {
    onpick: (file: File) => void;
    variant?: 'primary' | 'ghost';
    size?: 'regular' | 'small';
    loading?: boolean;
    disabled?: boolean;
    cameraLabel?: string;
    galleryLabel?: string;
  }

  let {
    onpick,
    variant = 'primary',
    size = 'regular',
    loading = false,
    disabled = false,
    cameraLabel = 'Scatta ora',
    galleryLabel = 'Galleria',
  }: Props = $props();
</script>

<!-- Two explicit ways in: take the photo now, or pick one already taken. -->
<div class="sources">
  <PhotoPickerButton camera block {variant} {size} {loading} {disabled} {onpick}>
    <Icon name="camera" size={size === 'small' ? 16 : 20} /> {cameraLabel}
  </PhotoPickerButton>
  <PhotoPickerButton block variant="ghost" {size} disabled={disabled || loading} {onpick}>
    <Icon name="image" size={size === 'small' ? 16 : 20} /> {galleryLabel}
  </PhotoPickerButton>
</div>

<style>
  .sources {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
</style>
