<script lang="ts">
  import type { Action } from '../../domain/action';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import DifficultyMeter from '../../ui/components/DifficultyMeter.svelte';
  import Disclosure from '../../ui/components/Disclosure.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import PhotoPickerButton from '../../ui/components/PhotoPickerButton.svelte';
  import PointsPill from '../../ui/components/PointsPill.svelte';
  import { DIFFICULTY_LABELS, DIFFICULTY_LEVELS, KIND_LABELS } from '../labels';

  interface Props {
    action: Action;
    busy: boolean;
    oncomplete: () => void;
    onpickphoto: (file: File) => void;
  }

  let { action, busy, oncomplete, onpickphoto }: Props = $props();
</script>

<Disclosure tone={action.kind}>
  {#snippet summary()}
    <span class="summary">
      <span class="dot" data-tone={action.kind} aria-hidden="true"></span>
      <span class="heading">
        <span class="title">{action.title}</span>
        <DifficultyMeter level={DIFFICULTY_LEVELS[action.difficulty]} label={DIFFICULTY_LABELS[action.difficulty]} />
      </span>
      {#if action.photoPolicy !== 'none'}
        <span class="camera" class:required={action.photoPolicy === 'required'} title="Foto">
          <Icon name="camera" size={18} />
        </span>
      {/if}
      <PointsPill points={action.points} />
    </span>
  {/snippet}

  <div class="meta">
    <Badge tone={action.kind}>{KIND_LABELS[action.kind]}</Badge>
    <Badge tone="neutral">{DIFFICULTY_LABELS[action.difficulty]}</Badge>
    {#if action.photoPolicy === 'required'}
      <Badge tone="neutral">Foto obbligatoria</Badge>
    {:else if action.photoPolicy === 'optional'}
      <Badge tone="neutral">Foto facoltativa</Badge>
    {/if}
  </div>
  <p class="description">{action.description}</p>
  {#if action.kind === 'common'}
    <p class="note">Vale per tutti: quando la segni compare fatta per ogni giocatore.</p>
  {/if}
  {#if action.photoPolicy !== 'none'}
    <p class="note"><Icon name="shield" size={14} /> La foto la vedete solo tu e l'admin.</p>
  {/if}

  <div class="buttons">
    {#if action.photoPolicy === 'required'}
      <PhotoPickerButton block loading={busy} onpick={onpickphoto}>
        <Icon name="camera" size={20} /> Scatta la foto e completa
      </PhotoPickerButton>
    {:else}
      <Button block loading={busy} onclick={oncomplete}>
        <Icon name="check" size={20} /> Fatta!
      </Button>
      {#if action.photoPolicy === 'optional'}
        <PhotoPickerButton block variant="ghost" disabled={busy} onpick={onpickphoto}>
          <Icon name="camera" size={20} /> Fatta, con foto
        </PhotoPickerButton>
      {/if}
    {/if}
  </div>
</Disclosure>

<style>
  .summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .dot {
    --tone: var(--color-bonus);
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--tone);
    box-shadow: 0 0 12px var(--tone);
  }

  .dot[data-tone='malus'] {
    --tone: var(--color-malus);
  }

  .dot[data-tone='common'] {
    --tone: var(--color-common);
  }

  .heading {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
  }

  .camera {
    color: var(--color-text-subtle);
  }

  .camera.required {
    color: var(--color-accent-3);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .description {
    line-height: var(--leading-normal);
  }

  .note {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
  }

  .buttons {
    display: grid;
    gap: var(--space-2);
  }
</style>
