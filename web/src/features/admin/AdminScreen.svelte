<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import type { AddActionError } from '../../application/add-action';
  import type { WriteFailure } from '../../application/ports';
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
  import AddActionDialog from './AddActionDialog.svelte';
  import type { AdminState } from './admin-state.svelte';

  interface Props {
    admin: AdminState;
    onlogout: () => void;
    onunauthorized: () => void;
  }

  let { admin, onlogout, onunauthorized }: Props = $props();

  type OpenDialog =
    | { kind: 'none' }
    | { kind: 'add' }
    | { kind: 'remove'; action: Action }
    | { kind: 'reset' };

  let dialog = $state<OpenDialog>({ kind: 'none' });
  let busy = $state(false);

  const SECTIONS: readonly { kind: ActionKind; title: string }[] = [
    { kind: 'common', title: 'Per tutti' },
    { kind: 'bonus', title: 'Bonus' },
    { kind: 'malus', title: 'Malus' },
  ];

  const titleOf = (kind: ActionKind) => SECTIONS.find((section) => section.kind === kind)?.title;

  const close = () => (dialog = { kind: 'none' });

  function reportFailure(failure: WriteFailure | AddActionError) {
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
</script>

<Screen>
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
    <Button block onclick={() => (dialog = { kind: 'add' })}>
      <Icon name="plus" size={20} /> Aggiungi azione
    </Button>

    {#each SECTIONS as section (section.kind)}
      {@const actions = admin.catalog.filter((action) => action.kind === section.kind)}
      <section class="section">
        <h2>{section.title} <span class="count">{actions.length}</span></h2>
        <ul class="list">
          {#each actions as action (action.id)}
            <li animate:flip={{ duration: duration('base') }} out:fly={{ x: -60, duration: duration('base'), easing }}>
              <Surface>
                <div class="row">
                  <p class="label">{action.label}</p>
                  <IconButton
                    icon="trash"
                    label="Elimina: {action.label}"
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
            Finita la festa? Cancella partecipanti e azioni segnate per ripartire da zero. La lista delle
            azioni resta.
          </p>
          <Button variant="danger" block onclick={() => (dialog = { kind: 'reset' })}>Termina e ricomincia</Button>
        </div>
      </Surface>
    </section>
  {/if}
</Screen>

<AddActionDialog
  open={dialog.kind === 'add'}
  onclose={close}
  onsubmit={(draft) => admin.add(draft)}
  onfailure={reportFailure}
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
        <Badge tone={dialog.action.kind}>{titleOf(dialog.action.kind)}</Badge>
        <p class="label">{dialog.action.label}</p>
      </div>
    </Surface>
  {/if}
  <p>Le volte in cui è già stata segnata verranno cancellate per tutti.</p>
</Dialog>

{#snippet confirmReset()}
  <Button variant="danger" block loading={busy} onclick={() => run(() => admin.resetEvening(), 'Serata azzerata: si riparte!')}>
    Sì, ricomincia da zero
  </Button>
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'reset'} title="Terminare la serata?" onclose={close} actions={confirmReset}>
  <p>
    Tutti i partecipanti e le azioni segnate verranno cancellati. Chi è dentro dovrà iscriversi di nuovo. Non si
    può annullare.
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
    gap: var(--space-3);
  }

  .label {
    flex: 1;
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
