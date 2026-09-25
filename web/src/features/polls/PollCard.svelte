<script lang="ts">
  import { canVote, hasVoted, isOpen, leadingOptions, shareOf, type Poll, type PollOption } from '../../domain/poll';
  import AvatarStack from '../../ui/components/AvatarStack.svelte';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import ResultBar from '../../ui/components/ResultBar.svelte';
  import SelectableRow from '../../ui/components/SelectableRow.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { formatRelative } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';

  interface Props {
    poll: Poll;
    now: Date;
    /** false for the admin, who does not vote. */
    canBallot: boolean;
    busy: boolean;
    links: PhotoLinksCache;
    onvote: (optionIds: string[]) => void;
    onmanage: () => void;
    onvoters: (option: PollOption) => void;
  }

  let { poll, now, canBallot, busy, links, onvote, onmanage, onvoters }: Props = $props();

  let changing = $state(false);
  let chosen = $state<string[]>([]);

  const open = $derived(isOpen(poll, now));
  const voting = $derived(canBallot && canVote(poll, now) && (!hasVoted(poll) || changing));
  const leading = $derived(open ? new Set<string>() : leadingOptions(poll));
  const minutesLeft = $derived(poll.closesAt ? Math.max(1, Math.ceil((poll.closesAt.getTime() - now.getTime()) / 60_000)) : null);

  const hiddenReason = $derived(
    poll.rules.results === 'after-close'
      ? 'I risultati si vedono quando il sondaggio si chiude.'
      : 'I risultati si vedono dopo che hai votato.',
  );

  function toggle(option: PollOption) {
    if (poll.rules.multiple) chosen = chosen.includes(option.id) ? chosen.filter((id) => id !== option.id) : [...chosen, option.id];
    else chosen = [option.id];
  }

  function startChange() {
    chosen = [...poll.myVotes];
    changing = true;
  }

  function submit() {
    onvote(chosen);
    changing = false;
    chosen = [];
  }
</script>

<Surface highlighted={open && canBallot && !hasVoted(poll)}>
  <article class="poll">
    <header class="head">
      <span class="meta">{poll.creator?.nickname ?? 'Admin'} · {formatRelative(poll.createdAt, now)}</span>
      <span class="badges">
        {#if !open}
          <Badge tone="neutral">Chiuso</Badge>
        {:else if minutesLeft !== null}
          <Badge tone="common">Chiude tra {minutesLeft < 60 ? `${minutesLeft} min` : `${Math.round(minutesLeft / 60)} h`}</Badge>
        {:else}
          <Badge tone="bonus">Aperto</Badge>
        {/if}
      </span>
      {#if poll.canManage}
        <IconButton icon="more" label="Gestisci il sondaggio" onclick={onmanage} />
      {/if}
    </header>

    <h2 class="question">{poll.question}</h2>
    <p class="rules">
      {poll.rules.anonymous ? 'Anonimo' : 'Voto palese'} · {poll.rules.multiple ? 'più scelte' : 'una scelta'}
      {#if poll.rules.closeWhenAllVoted && open} · si chiude quando votano tutti{/if}
    </p>

    {#if voting}
      <div class="options" role="group" aria-label="Opzioni">
        {#each poll.options as option (option.id)}
          <SelectableRow selected={chosen.includes(option.id)} onclick={() => toggle(option)}>
            <span class="option-label">{option.label}</span>
          </SelectableRow>
        {/each}
      </div>
      <div class="actions">
        <Button block loading={busy} disabled={chosen.length === 0} onclick={submit}>
          {changing ? 'Conferma il nuovo voto' : 'Vota'}
        </Button>
        {#if changing}<Button variant="ghost" block onclick={() => (changing = false)}>Annulla</Button>{/if}
      </div>
    {:else if poll.resultsVisible}
      <div class="options">
        {#each poll.options as option (option.id)}
          <div class="result">
            <ResultBar
              label={option.label}
              share={shareOf(option, poll)}
              count={option.votes ?? 0}
              mine={poll.myVotes.includes(option.id)}
              leading={leading.has(option.id)}
            />
            {#if option.voters && option.voters.length > 0}
              <AvatarStack
                label="Chi ha votato {option.label}"
                people={option.voters.map((v) => ({ id: v.id, nickname: v.nickname, src: links.get(v.avatarId)?.thumbnailUrl }))}
                onclick={() => onvoters(option)}
              />
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <ul class="plain">
        {#each poll.options as option (option.id)}
          <li class:mine={poll.myVotes.includes(option.id)}>{option.label}</li>
        {/each}
      </ul>
      <p class="hint">{hiddenReason}</p>
    {/if}

    <footer class="foot">
      <span>{poll.voterCount === 1 ? '1 persona ha votato' : `${poll.voterCount} persone hanno votato`}</span>
      {#if !voting && canBallot && open && hasVoted(poll) && poll.rules.voteChange}
        <Button size="small" variant="ghost" onclick={startChange}>Cambia voto</Button>
      {/if}
    </footer>
  </article>
</Surface>

<style>
  .poll {
    display: grid;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .meta {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .badges {
    flex: none;
  }

  .question {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: var(--leading-tight);
    overflow-wrap: anywhere;
  }

  .rules {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .options {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }

  .option-label {
    overflow-wrap: anywhere;
    font-weight: var(--weight-bold);
  }

  .result {
    display: grid;
    gap: var(--space-1);
    justify-items: start;
  }

  .result > :global(:first-child) {
    justify-self: stretch;
  }

  .actions {
    display: grid;
    gap: var(--space-2);
  }

  .plain {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .plain li {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    overflow-wrap: anywhere;
  }

  .plain li.mine {
    border-color: var(--color-accent-2);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
  }
</style>
