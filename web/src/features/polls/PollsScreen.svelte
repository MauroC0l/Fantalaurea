<script lang="ts">
  import { onMount } from 'svelte';
  import type { PollFailure } from '../../application/ports';
  import { isOpen, type Poll, type PollDraftError, type PollOption } from '../../domain/poll';
  import ActionSheet from '../../ui/components/ActionSheet.svelte';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import ScrollArea from '../../ui/components/ScrollArea.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import PollCard from './PollCard.svelte';
  import PollEditorDialog from './PollEditorDialog.svelte';
  import type { CreatePollError, PollsState } from './polls-state.svelte';

  interface Props {
    polls: PollsState;
    links: PhotoLinksCache;
    /** Admin, or a player the admin allowed (ADR 0018). */
    canCreate: boolean;
  }

  let { polls, links, canCreate }: Props = $props();

  let editing = $state(false);
  let saving = $state(false);
  let draftErrors = $state<readonly PollDraftError[]>([]);
  let managing = $state<Poll | null>(null);
  let removing = $state<Poll | null>(null);
  let voters = $state<{ poll: Poll; option: PollOption } | null>(null);

  const open = $derived(polls.polls.filter((p) => isOpen(p, polls.now)));
  const closed = $derived(polls.polls.filter((p) => !isOpen(p, polls.now)));

  const FAILURES: Record<Exclude<PollFailure, 'unauthorized'>, string> = {
    unavailable: 'Connessione assente: riprova',
    rejected: 'Operazione non valida',
    disabled: 'I sondaggi sono stati spenti dall’admin',
    forbidden: 'L’admin non ti ha dato il permesso di creare sondaggi',
    closed: 'Il sondaggio si è appena chiuso',
    locked: 'Hai già votato e qui non si può cambiare',
  };

  onMount(() => {
    polls.start();
    return () => polls.stop();
  });

  function report(error: PollFailure) {
    if (error !== 'unauthorized') toasts.show(FAILURES[error], 'error');
  }

  async function create(draft: Parameters<PollsState['create']>[0]) {
    saving = true;
    const result = await polls.create(draft);
    saving = false;
    if (result.ok) {
      editing = false;
      draftErrors = [];
      toasts.show('Sondaggio pubblicato');
      return;
    }
    const error: CreatePollError = result.error;
    if (typeof error === 'object') draftErrors = error.errors;
    else report(error);
  }

  async function vote(poll: Poll, optionIds: string[]) {
    const result = await polls.vote(poll, optionIds);
    if (!result.ok) report(result.error);
  }

  async function close(poll: Poll) {
    const result = await polls.close(poll);
    if (!result.ok) report(result.error);
  }

  async function remove() {
    const poll = removing;
    removing = null;
    if (!poll) return;
    const result = await polls.remove(poll);
    if (!result.ok) report(result.error);
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Tutti dicono la loro" title="Sondaggi">
    <p>{open.length === 1 ? '1 sondaggio aperto' : `${open.length} sondaggi aperti`}</p>
    {#snippet trailing()}
      {#if canCreate}
        <Button size="small" onclick={() => ((draftErrors = []), (editing = true))}><Icon name="plus" size={18} /> Nuovo</Button>
      {/if}
    {/snippet}
  </ScreenHeader>

  {#if polls.status === 'loading'}
    <Loader label="Carico i sondaggi…" />
  {:else if polls.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare i sondaggi">
      <Button variant="ghost" onclick={() => polls.refresh()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if polls.polls.length === 0}
    <EmptyState icon="checklist" title="Ancora nessun sondaggio">
      <p>{canCreate ? 'Crea il primo con "Nuovo".' : 'Quando l’admin ne pubblica uno, compare qui.'}</p>
    </EmptyState>
  {:else}
    {#each [{ title: 'Aperti', list: open }, { title: 'Chiusi', list: closed }] as section (section.title)}
      {#if section.list.length > 0}
        <section class="section">
          <h2>{section.title} <span class="count">{section.list.length}</span></h2>
          {#each section.list as poll (poll.id)}
            <PollCard
              {poll}
              now={polls.now}
              canBallot={polls.voter !== null}
              busy={polls.busy === poll.id}
              {links}
              onvote={(optionIds) => vote(poll, optionIds)}
              onmanage={() => (managing = poll)}
              onvoters={(option) => (voters = { poll, option })}
            />
          {/each}
        </section>
      {/if}
    {/each}
  {/if}
</Screen>

<PollEditorDialog open={editing} {saving} errors={draftErrors} onsave={create} onclose={() => (editing = false)} />

<ActionSheet
  open={managing !== null}
  title="Sondaggio"
  onclose={() => (managing = null)}
  items={managing
    ? [
        ...(isOpen(managing, polls.now)
          ? [{ icon: 'clock' as const, label: 'Chiudi adesso', onselect: () => managing && void close(managing) }]
          : []),
        { icon: 'trash' as const, label: 'Elimina', danger: true, onselect: () => (removing = managing) },
      ]
    : []}
/>

{#snippet removeActions()}
  <Button variant="danger" block onclick={remove}>Elimina il sondaggio</Button>
  <Button variant="ghost" block onclick={() => (removing = null)}>Annulla</Button>
{/snippet}

<Dialog open={removing !== null} title="Eliminare il sondaggio?" onclose={() => (removing = null)} actions={removeActions}>
  <p>Spariscono anche tutti i voti.</p>
</Dialog>

<Dialog open={voters !== null} title={voters?.option.label ?? ''} onclose={() => (voters = null)}>
  {#if voters?.option.voters}
    <ScrollArea maxHeight="50dvh" label="Chi ha votato">
      <ul class="voters">
        {#each voters.option.voters as voter (voter.id)}
          <li><Avatar name={voter.nickname} src={links.get(voter.avatarId)?.thumbnailUrl} size="sm" /> {voter.nickname}</li>
        {/each}
      </ul>
    </ScrollArea>
  {/if}
</Dialog>

<style>
  .section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  h2 {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .count {
    color: var(--color-text-subtle);
  }

  .voters {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .voters li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }
</style>
