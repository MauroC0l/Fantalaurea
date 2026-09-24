<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import type { WriteFailure } from '../../application/ports';
  import type { SaveActionError } from '../../application/save-action';
  import type { Action, ActionKind } from '../../domain/action';
  import type { Result } from '../../domain/result';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing } from '../../ui/theme/motion';
  import { KIND_LABELS, PHOTO_POLICY_LABELS } from '../labels';
  import ActionEditorDialog from './ActionEditorDialog.svelte';
  import type { AdminState } from './admin-state.svelte';

  interface Props {
    admin: AdminState;
    onlogout: () => void;
    onunauthorized: () => void;
    onopenalbum: () => void;
  }

  let { admin, onlogout, onunauthorized, onopenalbum }: Props = $props();

  type OpenDialog =
    | { kind: 'none' }
    | { kind: 'edit'; action: Action | 'new' }
    | { kind: 'remove'; action: Action }
    | { kind: 'photos-reminder'; photoCount: number }
    | { kind: 'reset' };

  let dialog = $state<OpenDialog>({ kind: 'none' });
  let busy = $state(false);

  const SECTIONS: readonly ActionKind[] = ['common', 'bonus', 'malus'];

  const close = () => (dialog = { kind: 'none' });

  function reportFailure(failure: WriteFailure | SaveActionError) {
    const kind = typeof failure === 'string' ? failure : failure.kind;
    if (kind === 'unauthorized') onunauthorized();
    else toasts.show('Operazione non riuscita: riprova', 'error');
  }

  async function run(operation: () => Promise<Result<void, WriteFailure>>, success: string) {
    busy = true;
    const result = await operation();
    busy = false;
    close();
    if (result.ok) toasts.show(success);
    else reportFailure(result.error);
  }

  /** Photos are deleted with the evening: remind to save them first (only if there are any). */
  async function askToReset() {
    busy = true;
    const count = await admin.photoCount();
    busy = false;
    if (!count.ok) return reportFailure(count.error);
    dialog = count.value > 0 ? { kind: 'photos-reminder', photoCount: count.value } : { kind: 'reset' };
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Pannello admin" title="Gestisci la serata">
    <p>
      {admin.participantCount === 1 ? '1 partecipante' : `${admin.participantCount} partecipanti`} ·
      {admin.catalog.length} azioni
    </p>
    {#snippet trailing()}
      <IconButton icon="logout" label="Esci dal pannello" onclick={onlogout} />
    {/snippet}
  </ScreenHeader>

  {#if admin.status === 'loading'}
    <Loader label="Carico la serata…" />
  {:else if admin.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare la serata">
      <Button variant="ghost" onclick={() => admin.start()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else}
    <Button block onclick={() => (dialog = { kind: 'edit', action: 'new' })}>
      <Icon name="plus" size={20} /> Aggiungi azione
    </Button>

    {#each SECTIONS as section (section)}
      {@const actions = admin.catalog.filter((action) => action.kind === section)}
      <section class="section">
        <h2>{KIND_LABELS[section]} <span class="count">{actions.length}</span></h2>
        <ul class="list">
          {#each actions as action (action.id)}
            <li animate:flip={{ duration: duration('base') }} out:fly={{ x: -60, duration: duration('base'), easing }}>
              <Surface>
                <div class="row">
                  <button class="edit" onclick={() => (dialog = { kind: 'edit', action })}>
                    <span class="title">{action.title}</span>
                    {#if action.photoPolicy !== 'none'}
                      <span class="photo"><Icon name="camera" size={14} /> {PHOTO_POLICY_LABELS[action.photoPolicy]}</span>
                    {/if}
                  </button>
                  <IconButton icon="pencil" label="Modifica: {action.title}" onclick={() => (dialog = { kind: 'edit', action })} />
                  <IconButton
                    icon="trash"
                    label="Elimina: {action.title}"
                    danger
                    onclick={() => (dialog = { kind: 'remove', action })}
                  />
                </div>
              </Surface>
            </li>
          {:else}
            <li class="none">Nessuna azione.</li>
          {/each}
        </ul>
      </section>
    {/each}

    <section class="section">
      <h2>Serata</h2>
      <Surface tone="malus" highlighted>
        <div class="danger-zone">
          <p>
            Finita la festa? Cancella partecipanti, azioni segnate e foto per ripartire da zero. La lista delle azioni
            resta.
          </p>
          <Button variant="danger" block loading={busy} onclick={askToReset}>Termina e ricomincia</Button>
        </div>
      </Surface>
    </section>
  {/if}
</Screen>

<ActionEditorDialog
  editing={dialog.kind === 'edit' ? dialog.action : null}
  onsave={(target, draft) => admin.save(target, draft)}
  onfailure={reportFailure}
  onclose={close}
/>

{#snippet confirmRemove()}
  {#if dialog.kind === 'remove'}
    {@const action = dialog.action}
    <Button variant="danger" block loading={busy} onclick={() => run(() => admin.remove(action), 'Azione eliminata')}>
      Elimina
    </Button>
  {/if}
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'remove'} title="Eliminare questa azione?" onclose={close} actions={confirmRemove}>
  {#if dialog.kind === 'remove'}
    <Surface>
      <div class="preview">
        <Badge tone={dialog.action.kind}>{KIND_LABELS[dialog.action.kind]}</Badge>
        <p class="title">{dialog.action.title}</p>
        <p>{dialog.action.description}</p>
      </div>
    </Surface>
  {/if}
  <p>Chi l'ha già completata la perde, insieme alle eventuali foto.</p>
</Dialog>

{#snippet reminderActions()}
  <Button
    block
    onclick={() => {
      close();
      onopenalbum();
    }}
  >
    <Icon name="image" size={20} /> Vai all'album
  </Button>
  <Button variant="danger" block onclick={() => (dialog = { kind: 'reset' })}>Le ho salvate, continua</Button>
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'photos-reminder'} title="Hai salvato le foto?" onclose={close} actions={reminderActions}>
  {#if dialog.kind === 'photos-reminder'}
    <p>
      Nell'album ci sono <strong>{dialog.photoCount} foto</strong>. Terminando la
      serata verranno cancellate per sempre: prima scaricale o condividile dall'album.
    </p>
  {/if}
</Dialog>

{#snippet confirmReset()}
  <Button variant="danger" block loading={busy} onclick={() => run(() => admin.resetEvening(), 'Serata azzerata: si riparte!')}>
    Sì, ricomincia da zero
  </Button>
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'reset'} title="Terminare la serata?" onclose={close} actions={confirmReset}>
  <p>
    Partecipanti, azioni segnate e foto verranno cancellati. Chi è dentro dovrà iscriversi di nuovo. Non si può
    annullare.
  </p>
</Dialog>

<style>
  .section {
    display: grid;
    gap: var(--space-3);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-md);
  }

  .count {
    color: var(--color-text-subtle);
  }

  .list {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .edit {
    flex: 1;
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    text-align: left;
  }

  .title {
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
  }

  .photo {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-accent-3);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
  }

  .preview {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
    color: var(--color-text);
  }

  .none {
    color: var(--color-text-subtle);
  }

  .danger-zone {
    display: grid;
    gap: var(--space-4);
    color: var(--color-text-muted);
  }
</style>
