<script lang="ts">
  import { onMount } from 'svelte';
  import { matchesSearch, type ManagedPlayer, type Permission } from '../../domain/player';
  import { PHOTO_LIMIT } from '../../domain/profile';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import Switch from '../../ui/components/Switch.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import type { UsersState } from './users-state.svelte';

  let { users, links }: { users: UsersState; links: PhotoLinksCache } = $props();

  type Filter = 'all' | 'blocked' | 'allowed';
  const FILTERS: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tutti' },
    { value: 'allowed', label: 'Con permessi' },
    { value: 'blocked', label: 'Bloccati' },
  ];
  const PERMISSIONS: readonly { name: Permission; label: string; description: string }[] = [
    { name: 'polls', label: 'Può creare sondaggi', description: 'Nella sezione Sondaggi, come l’admin' },
    { name: 'challenges', label: 'Può creare sfide a tempo', description: 'Nella sezione Azioni, come l’admin' },
  ];

  let query = $state('');
  let filter = $state<Filter>('all');
  let openId = $state<string | null>(null);
  let confirmingBlock = $state(false);

  const open = $derived(users.players.find((p) => p.id === openId) ?? null);
  const visible = $derived(
    users.players.filter(
      (p) =>
        matchesSearch(p, query) &&
        (filter === 'all' ||
          (filter === 'blocked' && p.blocked) ||
          (filter === 'allowed' && (p.permissions.polls || p.permissions.challenges))),
    ),
  );
  const blockedCount = $derived(users.players.filter((p) => p.blocked).length);

  onMount(() => {
    void users.start();
    return () => users.stop();
  });

  async function setPermission(player: ManagedPlayer, permission: Permission, enabled: boolean) {
    const result = await users.setPermission(player, permission, enabled);
    if (!result.ok && result.error !== 'unauthorized') toasts.show('Non sono riuscito a cambiarlo', 'error');
  }

  async function setBlocked(player: ManagedPlayer, blocked: boolean) {
    confirmingBlock = false;
    const result = await users.setBlocked(player, blocked);
    if (result.ok) toasts.show(blocked ? `${player.nickname} è stato tolto dalla serata` : `${player.nickname} può rientrare`);
    else if (result.error !== 'unauthorized') toasts.show('Operazione non riuscita: riprova', 'error');
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Pannello admin" title="Utenti">
    <p>
      {users.players.length === 1 ? '1 persona' : `${users.players.length} persone`}{blockedCount > 0
        ? ` · ${blockedCount} bloccat${blockedCount === 1 ? 'a' : 'e'}`
        : ''}
    </p>
  </ScreenHeader>

  {#if users.status === 'loading'}
    <Loader label="Carico gli utenti…" />
  {:else if users.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare gli utenti">
      <Button variant="ghost" onclick={() => users.refresh()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else}
    <div class="tools">
      <TextField name="search" label="Cerca per nickname o nome" bind:value={query} autocapitalize="off" />
      <SegmentedControl options={FILTERS} bind:value={filter} label="Filtra gli utenti" />
    </div>

    {#if visible.length === 0}
      <EmptyState icon="users" title="Nessuno qui">
        <p>{query ? 'Nessun nome corrisponde alla ricerca.' : 'Nessun utente in questo elenco.'}</p>
      </EmptyState>
    {:else}
      <ul class="list">
        {#each visible as player (player.id)}
          <li>
            <button class="row-button" onclick={() => (openId = player.id)}>
              <Surface tone={player.blocked ? 'malus' : undefined}>
                <div class="row" class:blocked={player.blocked}>
                  <Avatar name={player.nickname} src={links.get(player.avatarId)?.thumbnailUrl} />
                  <span class="names">
                    <span class="nickname">{player.nickname}</span>
                    <span class="real-name">{player.realName}</span>
                    <span class="badges">
                      {#if player.blocked}<Badge tone="malus">Bloccato</Badge>{/if}
                      {#if player.permissions.polls}<Badge tone="common">Sondaggi</Badge>{/if}
                      {#if player.permissions.challenges}<Badge tone="common">Sfide</Badge>{/if}
                    </span>
                  </span>
                  <span class="photos" class:full={player.photos >= PHOTO_LIMIT}>
                    <Icon name="image" size={14} />
                    {player.photos}
                  </span>
                </div>
              </Surface>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Screen>

{#snippet playerActions()}
  {#if open}
    {#if open.blocked}
      <Button block onclick={() => setBlocked(open, false)}><Icon name="undo" size={20} /> Sblocca</Button>
    {:else}
      <Button variant="danger" block onclick={() => (confirmingBlock = true)}><Icon name="shield" size={20} /> Blocca</Button>
    {/if}
    <Button variant="ghost" block onclick={() => (openId = null)}>Chiudi</Button>
  {/if}
{/snippet}

<Dialog open={open !== null && !confirmingBlock} title={open?.nickname ?? ''} onclose={() => (openId = null)} actions={playerActions}>
  {#if open}
    <p>
      {open.realName} · {open.photos} di {PHOTO_LIMIT} foto · entrato alle
      {open.joinedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
    </p>
    <div class="switches">
      {#each PERMISSIONS as permission (permission.name)}
        <Switch
          checked={open.permissions[permission.name]}
          label={permission.label}
          description={permission.description}
          disabled={open.blocked}
          onchange={(enabled) => setPermission(open, permission.name, enabled)}
        />
      {/each}
    </div>
  {/if}
</Dialog>

{#snippet blockActions()}
  {#if open}
    <Button variant="danger" block onclick={() => setBlocked(open, true)}>Blocca {open.nickname}</Button>
  {/if}
  <Button variant="ghost" block onclick={() => (confirmingBlock = false)}>Annulla</Button>
{/snippet}

<Dialog open={confirmingBlock} title="Bloccare {open?.nickname ?? ''}?" onclose={() => (confirmingBlock = false)} actions={blockActions}>
  <p>
    Esce subito dalla serata e non può rientrare, né con questo nickname né con il suo nome vero. I suoi post, le foto e
    i messaggi spariscono per tutti, ma non vengono cancellati: sbloccandolo torna tutto com’era.
  </p>
</Dialog>

<style>
  .tools {
    display: grid;
    gap: var(--space-3);
  }

  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    list-style: none;
  }

  .row-button {
    display: block;
    width: 100%;
    text-align: left;
    -webkit-touch-callout: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .row.blocked :global(.avatar) {
    filter: grayscale(1);
    opacity: 0.6;
  }

  .names {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .nickname {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-black);
  }

  .real-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .badges:empty {
    display: none;
  }

  .photos {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex: none;
    color: var(--color-text-subtle);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }

  .photos.full {
    color: var(--color-danger);
  }

  .switches {
    display: grid;
    gap: var(--space-3);
  }
</style>
