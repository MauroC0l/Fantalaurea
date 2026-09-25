<script lang="ts">
  import type { ChallengeFailure, WriteFailure } from '../../application/ports';
  import type { Challenge, ChallengeCompleter, ChallengeDraftError } from '../../domain/challenge';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import ScrollArea from '../../ui/components/ScrollArea.svelte';
  import { formatTime } from '../labels';
  import type { Result } from '../../domain/result';
  import ActionSheet, { type SheetItem } from '../../ui/components/ActionSheet.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import ChallengeCard from './ChallengeCard.svelte';
  import ChallengeEditorDialog, { type ChallengeForm } from './ChallengeEditorDialog.svelte';
  import type { ChallengesState, SaveChallengeError } from './challenges-state.svelte';

  interface Props {
    challenges: ChallengesState;
    links: PhotoLinksCache;
    /** The admin, or a player the admin allowed (ADR 0018). */
    canCreate: boolean;
    /** "board": running and finished, with Nuova; "mine": only those you completed (for "Fatte"). */
    view?: 'board' | 'mine';
  }

  let { challenges, links, canCreate, view = 'board' }: Props = $props();

  let completers = $state<{ challenge: Challenge; list: readonly ChallengeCompleter[] | null } | null>(null);

  async function showCompleters(challenge: Challenge) {
    completers = { challenge, list: null };
    const list = await challenges.completers(challenge);
    if (completers?.challenge.id === challenge.id) completers = { challenge, list: list ?? [] };
  }

  const FINISHED_SHOWN = 3;

  let editing = $state<Challenge | 'new' | null>(null);
  let saving = $state(false);
  let formErrors = $state<readonly ChallengeDraftError[]>([]);
  let managing = $state<Challenge | null>(null);
  let removing = $state<Challenge | null>(null);
  let showAllFinished = $state(false);

  const finished = $derived(showAllFinished ? challenges.finished : challenges.finished.slice(0, FINISHED_SHOWN));

  const FAILURES: Record<Exclude<ChallengeFailure, 'unauthorized'>, string> = {
    unavailable: 'Connessione assente: riprova',
    rejected: 'Operazione non valida',
    disabled: 'Le sfide sono state spente dall’admin',
    forbidden: 'L’admin non ti ha dato il permesso di creare sfide',
    ended: 'Troppo tardi: la sfida è finita',
    full: 'Troppo tardi: i primi l’hanno già fatta',
  };

  function report(result: Result<void, ChallengeFailure | WriteFailure>) {
    if (!result.ok && result.error !== 'unauthorized') toasts.show(FAILURES[result.error], 'error');
  }

  async function save(form: ChallengeForm) {
    const target = editing;
    if (target === null) return;
    saving = true;
    const result: Result<void, SaveChallengeError> =
      target === 'new'
        ? await challenges.create({ ...form, durationMinutes: form.minutes ?? 15 })
        : await challenges.update(target, { ...form, extendMinutes: form.minutes });
    saving = false;
    if (result.ok) {
      editing = null;
      formErrors = [];
      toasts.show(target === 'new' ? 'Sfida lanciata: tutti la vedono' : 'Sfida aggiornata');
    } else if (typeof result.error === 'object') {
      formErrors = result.error.errors;
    } else {
      report({ ok: false, error: result.error });
    }
  }

  function itemsFor(challenge: Challenge): SheetItem[] {
    return [
      { icon: 'pencil', label: 'Modifica', onselect: () => ((formErrors = []), (editing = challenge)) },
      ...(challenges.running.includes(challenge)
        ? [{ icon: 'clock' as const, label: 'Termina adesso', onselect: () => void challenges.end(challenge).then(report) }]
        : []),
      { icon: 'trash', label: 'Elimina', danger: true, onselect: () => (removing = challenge) },
    ];
  }

  async function remove() {
    const challenge = removing;
    removing = null;
    if (challenge) report(await challenges.remove(challenge));
  }
</script>

{#if view === 'mine'}
  {#if challenges.mine.length > 0}
    <section class="section" aria-label="Sfide a tempo fatte">
      <h3 class="subhead"><Icon name="clock" size={14} /> Sfide a tempo</h3>
      {#each challenges.mine as challenge (challenge.id)}
        <ChallengeCard
          {challenge}
          now={challenges.now}
          canTakePart={challenges.player !== null}
          busy={challenges.busy === challenge.id}
          {links}
          oncomplete={() => {}}
          onundo={() => void challenges.undo(challenge).then(report)}
          onmanage={() => (managing = challenge)}
          oncompleters={() => showCompleters(challenge)}
        />
      {/each}
      <h3 class="subhead">Azioni</h3>
    </section>
  {/if}
{:else if challenges.challenges.length > 0 || canCreate}
  <section class="section" aria-label="Sfide a tempo">
    <div class="head">
      <h2><Icon name="clock" size={20} /> Sfide a tempo</h2>
      {#if canCreate}
        <Button size="small" onclick={() => ((formErrors = []), (editing = 'new'))}><Icon name="plus" size={16} /> Nuova</Button>
      {/if}
    </div>

    {#if challenges.running.length === 0}
      <p class="empty">{canCreate ? 'Nessuna sfida in corso: lanciane una.' : 'Nessuna sfida in corso. Quando parte, te ne accorgi.'}</p>
    {/if}
    {#each challenges.running as challenge (challenge.id)}
      <ChallengeCard
        {challenge}
        now={challenges.now}
        canTakePart={challenges.player !== null}
        busy={challenges.busy === challenge.id}
        {links}
        oncomplete={() => void challenges.complete(challenge).then(report)}
        onundo={() => void challenges.undo(challenge).then(report)}
        onmanage={() => (managing = challenge)}
        oncompleters={() => showCompleters(challenge)}
      />
    {/each}

    {#if challenges.finished.length > 0}
      <h3 class="subhead">Finite</h3>
      {#each finished as challenge (challenge.id)}
        <ChallengeCard
          {challenge}
          now={challenges.now}
          canTakePart={challenges.player !== null}
          busy={challenges.busy === challenge.id}
          {links}
          oncomplete={() => {}}
          onundo={() => {}}
          onmanage={() => (managing = challenge)}
          oncompleters={() => showCompleters(challenge)}
        />
      {/each}
      {#if challenges.finished.length > FINISHED_SHOWN}
        <Button variant="ghost" size="small" onclick={() => (showAllFinished = !showAllFinished)}>
          {showAllFinished ? 'Mostra meno' : `Mostra tutte (${challenges.finished.length})`}
        </Button>
      {/if}
    {/if}
  </section>
{/if}

<Dialog open={completers !== null} title={completers?.challenge.title ?? ''} onclose={() => (completers = null)}>
  {#if completers?.list === null}
    <Loader label="Carico chi l’ha fatta…" />
  {:else if completers}
    <ScrollArea maxHeight="55dvh" label="Chi l’ha fatta">
      <ol class="completers">
        {#each completers.list ?? [] as person (person.id)}
          <li class:late={!person.earned}>
            <span class="rank">{person.rank}°</span>
            <Avatar name={person.nickname} src={links.get(person.avatarId)?.thumbnailUrl} size="sm" />
            <span class="who">{person.nickname}</span>
            <span class="when">{person.earned ? formatTime(person.at) : 'senza punti'}</span>
          </li>
        {:else}
          <li>Ancora nessuno.</li>
        {/each}
      </ol>
    </ScrollArea>
  {/if}
</Dialog>

<ChallengeEditorDialog target={editing} {saving} errors={formErrors} onsave={save} onclose={() => (editing = null)} />

<ActionSheet open={managing !== null} title={managing?.title ?? ''} items={managing ? itemsFor(managing) : []} onclose={() => (managing = null)} />

{#snippet removeActions()}
  <Button variant="danger" block onclick={remove}>Elimina la sfida</Button>
  <Button variant="ghost" block onclick={() => (removing = null)}>Annulla</Button>
{/snippet}

<Dialog open={removing !== null} title="Eliminare la sfida?" onclose={() => (removing = null)} actions={removeActions}>
  <p>Chi l’ha fatta perde i punti che ci aveva preso.</p>
</Dialog>

<style>
  .section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  h2 {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .subhead {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-black);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .completers {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .completers li {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text);
  }

  .completers li.late {
    opacity: 0.55;
  }

  .rank {
    width: 2.5ch;
    color: var(--color-text-subtle);
    font-weight: var(--weight-black);
    font-variant-numeric: tabular-nums;
  }

  .who {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-bold);
  }

  .when {
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
  }

  .empty {
    color: var(--color-text-muted);
  }
</style>
