<script lang="ts">
  import type { OwnPhoto } from '../../application/ports';
  import type { Action } from '../../domain/action';
  import type { Completion } from '../../domain/completion';
  import Button from '../../ui/components/Button.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import PointsPill from '../../ui/components/PointsPill.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import Thumbnail from '../../ui/components/Thumbnail.svelte';
  import { formatTime } from '../labels';

  interface Props {
    action: Action;
    completion: Completion;
    photo: OwnPhoto | undefined;
    mine: boolean;
    busy: boolean;
    onundo: () => void;
    ondeletephoto: () => void;
    onpickphoto: (file: File) => void;
    onviewphoto: () => void;
  }

  let { action, completion, photo, mine, busy, onundo, ondeletephoto, onpickphoto, onviewphoto }: Props = $props();

  const when = $derived(formatTime(completion.completedAt));
  const canAddPhoto = $derived(mine && !photo && action.photoPolicy === 'optional');
</script>

<Surface tone={action.kind} highlighted>
  <div class="item">
    <div class="row">
      <span class="check" data-tone={action.kind}><Icon name="check" size={18} /></span>
      <div class="text">
        <p class="title">{action.title}</p>
        <p class="when">
          {mine ? `Fatta alle ${when}` : `Segnata da ${completion.by.nickname} alle ${when}`}
        </p>
      </div>
      <PointsPill points={action.points} />
      {#if photo}
        <span class="thumb">
          <Thumbnail src={photo.thumbnailUrl} alt="La tua foto per {action.title}" onclick={onviewphoto} />
        </span>
      {/if}
    </div>

    {#if mine}
      <div class="buttons">
        <Button size="small" variant="ghost" disabled={busy} onclick={onundo}>
          <Icon name="undo" size={16} /> Annulla
        </Button>
        {#if photo}
          <Button size="small" variant="ghost" disabled={busy} onclick={ondeletephoto}>
            <Icon name="trash" size={16} /> Elimina foto
          </Button>
        {:else if canAddPhoto}
          <PhotoPickerButton size="small" variant="ghost" loading={busy} onpick={onpickphoto}>
            <Icon name="camera" size={16} /> Aggiungi foto
          </PhotoPickerButton>
        {/if}
      </div>
    {/if}
  </div>
</Surface>

<style>
  .item {
    display: grid;
    gap: var(--space-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .check {
    --tone: var(--color-bonus);
    display: grid;
    place-items: center;
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--tone);
    color: var(--color-on-accent);
  }

  .check[data-tone='malus'] {
    --tone: var(--color-malus);
  }

  .check[data-tone='common'] {
    --tone: var(--color-common);
  }

  .text {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
  }

  .when {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .thumb {
    flex: none;
    width: 56px;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
