<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import type { CompleteError } from '../../application/complete-action';
  import type { Haptics, WriteFailure } from '../../application/ports';
  import type { Action, ActionKind, Difficulty } from '../../domain/action';
  import { effectOfDeletingPhoto } from '../../domain/completion';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Lightbox from '../../ui/components/Lightbox.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import ProgressBar from '../../ui/components/ProgressBar.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import ChipGroup from '../../ui/components/ChipGroup.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import { celebrations } from '../../ui/components/celebrations.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import { DIFFICULTY_LABELS, PHOTO_LIMIT_MESSAGE } from '../labels';
  import type { GameState } from '../game/game-state.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import ActionItem from './ActionItem.svelte';
  import CompletedItem from './CompletedItem.svelte';
  import PhotoConfirmDialog from './PhotoConfirmDialog.svelte';

  interface Props {
    game: GameState;
    links: PhotoLinksCache;
    haptics: Haptics;
    /**
     * Timed challenges, when on: their counts join the totals, the "A tempo" filter shows `board`,
     * "Fatte" starts with `done`. This screen does not know what a challenge is.
     */
    timed?: { readonly todo: number; readonly done: number; readonly total: number; readonly board: Snippet; readonly doneList: Snippet };
  }

  let { game, links, haptics, timed }: Props = $props();

  type Filter = 'all' | 'bonus' | 'malus' | 'timed' | 'done';

  const doneCount = $derived(game.done.length + (timed?.done ?? 0));
  const totalCount = $derived(game.catalog.length + (timed?.total ?? 0));

  const FILTERS = $derived<readonly { value: Filter; label: string }[]>([
    { value: 'all', label: 'Tutte' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'malus', label: 'Malus' },
    ...(timed ? [{ value: 'timed' as const, label: timed.todo > 0 ? `A tempo ${timed.todo}` : 'A tempo' }] : []),
    { value: 'done', label: `Fatte ${doneCount}` },
  ]);

  const VISIBLE_KINDS: Record<Exclude<Filter, 'done' | 'timed'>, readonly ActionKind[]> = {
    all: ['common', 'bonus', 'malus'],
    bonus: ['common', 'bonus'],
    malus: ['malus'],
  };

  type OpenDialog =
    | { kind: 'none' }
    | { kind: 'confirm-photo'; action: Action; file: File }
    | { kind: 'undo'; action: Action }
    | { kind: 'delete-photo'; action: Action }
    | { kind: 'view-photo'; action: Action };

  type DifficultyFilter = Difficulty | 'any';

  const DIFFICULTIES: readonly { value: DifficultyFilter; label: string }[] = [
    { value: 'any', label: 'Ogni livello' },
    ...(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => ({ value, label: DIFFICULTY_LABELS[value] })),
  ];

  let filter = $state<Filter>('all');
  let difficulty = $state<DifficultyFilter>('any');
  let dialog = $state<OpenDialog>({ kind: 'none' });

  // The filter may point to "A tempo" after the admin switched challenges off.
  const shown = $derived<Filter>(filter === 'timed' && !timed ? 'all' : filter);

  const todo = $derived(
    shown === 'done' || shown === 'timed' ? [] : VISIBLE_KINDS[shown].flatMap((kind) =>
          game.todo.filter((action) => action.kind === kind && (difficulty === 'any' || action.difficulty === difficulty)),
        ),
  );

  const MESSAGES: Record<Exclude<CompleteError, 'unauthorized'>, string> = {
    unavailable: 'Connessione assente: riprova tra un attimo',
    rejected: 'Operazione non riuscita: riprova',
    'photo-required': 'Per questa azione serve una foto',
    'unreadable-photo': 'Non riesco a leggere questa foto: provane un’altra',
    'photo-limit': PHOTO_LIMIT_MESSAGE,
  };

  function report(error: CompleteError | WriteFailure) {
    if (error !== 'unauthorized') toasts.show(MESSAGES[error], 'error');
  }

  const close = () => (dialog = { kind: 'none' });

  async function complete(action: Action, file: File | null) {
    const result = await game.complete(action, file);
    if (!result.ok) return report(result.error);
    close();
    haptics.pulse(action.kind === 'malus' ? 'warning' : 'success');
    celebrations.burst(action.kind);
    toasts.show(action.kind === 'malus' ? `Malus segnato: ${action.title}` : `Fatta: ${action.title}!`);
  }

  async function undo(action: Action) {
    const result = await game.undo(action);
    close();
    if (result.ok) toasts.show(`Annullata: ${action.title}`);
    else report(result.error);
  }

  async function deletePhoto(action: Action) {
    const result = await game.deletePhoto(action);
    close();
    if (!result.ok) return report(result.error);
    toasts.show(result.value.undone ? 'Foto eliminata e azione annullata' : 'Foto eliminata');
  }

  const pickPhoto = (action: Action) => (file: File) => (dialog = { kind: 'confirm-photo', action, file });
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Ciao, {game.session.player.nickname}" title="Le tue azioni">
    <div class="progress">
      <p class="score"><strong>{game.me?.points ?? 0}</strong> punti</p>
      <p><strong>{doneCount}</strong> su {totalCount} completate</p>
      <ProgressBar value={doneCount} max={totalCount} label="Azioni completate" />
    </div>
  </ScreenHeader>

  {#if game.status === 'loading'}
    <Loader label="Carico le azioni…" />
  {:else if game.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare le azioni">
      <p>Controlla la connessione e riprova.</p>
      <Button variant="ghost" onclick={() => game.start()}>
        <Icon name="refresh" size={20} /> Riprova
      </Button>
    </EmptyState>
  {:else}
    <ChipGroup label="Filtra le azioni" options={FILTERS} bind:value={filter} scroll />
    {#if shown !== 'done' && shown !== 'timed'}
      <SegmentedControl label="Filtra per difficoltà" options={DIFFICULTIES} bind:value={difficulty} />
    {/if}

    {#if shown === 'timed' && timed}
      {@render timed.board()}
    {:else if shown === 'done'}
      {#if timed}{@render timed.doneList()}{/if}
      <p class="privacy"><Icon name="image" size={16} /> Le foto delle azioni compaiono in bacheca: le vedono tutti i partecipanti.</p>
      <ul class="list">
        {#each game.done as action (action.id)}
          {@const completion = game.completionOf(action)!}
          <li animate:flip={{ duration: duration('base') }} in:fly={{ y: 20, duration: duration('base'), easing }}>
            <CompletedItem
              {action}
              {completion}
              photo={links.get(completion.photoId)}
              mine={game.canChange(action)}
              busy={game.isBusy(action)}
              onundo={() => (dialog = { kind: 'undo', action })}
              ondeletephoto={() => (dialog = { kind: 'delete-photo', action })}
              onpickphoto={pickPhoto(action)}
              onviewphoto={() => (dialog = { kind: 'view-photo', action })}
            />
          </li>
        {:else}
          {#if doneCount === 0}
            <li>
              <EmptyState icon="sparkle" title="Ancora niente">
                <p>Le azioni che completi finiscono qui.</p>
              </EmptyState>
            </li>
          {/if}
        {/each}
      </ul>
    {:else}
      <ul class="list">
        {#each todo as action, index (action.id)}
          <li
            animate:flip={{ duration: duration('base') }}
            in:fly={{ y: 20, duration: duration('base'), delay: stagger(index), easing }}
            out:fly={{ x: 80, duration: duration('base'), easing }}
          >
            <ActionItem
              {action}
              busy={game.isBusy(action)}
              oncomplete={() => complete(action, null)}
              onpickphoto={pickPhoto(action)}
            />
          </li>
        {:else}
          <li>
            <EmptyState icon="party" title="Tutto fatto!">
              <p>Qui non resta niente da completare. Leggenda.</p>
            </EmptyState>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Screen>

<PhotoConfirmDialog
  action={dialog.kind === 'confirm-photo' ? dialog.action : null}
  file={dialog.kind === 'confirm-photo' ? dialog.file : null}
  sending={dialog.kind === 'confirm-photo' && game.isBusy(dialog.action)}
  onsend={() => dialog.kind === 'confirm-photo' && complete(dialog.action, dialog.file)}
  onrepick={(file) => dialog.kind === 'confirm-photo' && (dialog = { ...dialog, file })}
  onclose={close}
/>

{#snippet undoActions()}
  {#if dialog.kind === 'undo'}
    {@const action = dialog.action}
    <Button variant="danger" block loading={game.isBusy(action)} onclick={() => undo(action)}>Annulla l'azione</Button>
  {/if}
  <Button variant="ghost" block onclick={close}>Lascia com'è</Button>
{/snippet}

<Dialog open={dialog.kind === 'undo'} title="Annullare l'azione?" onclose={close} actions={undoActions}>
  {#if dialog.kind === 'undo'}
    <p>
      <strong>{dialog.action.title}</strong> tornerà tra quelle da fare.
      {#if game.completionOf(dialog.action)?.photoId}Anche la foto verrà eliminata.{/if}
    </p>
  {/if}
</Dialog>

{#snippet deletePhotoActions()}
  {#if dialog.kind === 'delete-photo'}
    {@const action = dialog.action}
    <Button variant="danger" block loading={game.isBusy(action)} onclick={() => deletePhoto(action)}>
      {effectOfDeletingPhoto(action).undoesAction ? 'Elimina e annulla' : 'Elimina la foto'}
    </Button>
  {/if}
  <Button variant="ghost" block onclick={close}>Tieni la foto</Button>
{/snippet}

<Dialog open={dialog.kind === 'delete-photo'} title="Eliminare la foto?" onclose={close} actions={deletePhotoActions}>
  {#if dialog.kind === 'delete-photo'}
    {#if effectOfDeletingPhoto(dialog.action).undoesAction}
      <p>Cancellando la foto annulli l'azione <strong>{dialog.action.title}</strong>: la foto è obbligatoria. Continuare?</p>
    {:else}
      <p>L'azione <strong>{dialog.action.title}</strong> resta completata.</p>
    {/if}
  {/if}
</Dialog>

<Lightbox
  src={dialog.kind === 'view-photo' ? (links.get(game.completionOf(dialog.action)?.photoId)?.fullUrl ?? null) : null}
  alt={dialog.kind === 'view-photo' ? `Foto per ${dialog.action.title}` : ''}
  onclose={close}
/>


<style>
  .progress {
    display: grid;
    gap: var(--space-2);
  }

  .score strong {
    font-size: var(--text-xl);
    background: var(--gradient-party);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }

  .progress strong {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--color-text);
  }

  .privacy {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .list {
    display: grid;
    gap: var(--space-3);
    list-style: none;
  }
</style>
