<script lang="ts">
  import { flip } from 'svelte/animate';
  import { previewOf } from '../../domain/chat';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Button from '../../ui/components/Button.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import { duration } from '../../ui/theme/motion';
  import { formatRelative } from '../labels';
  import type { PhotoLinksCache } from '../photos/photo-links.svelte';
  import { hrefTo } from '../routes';
  import type { ChatListState } from './chat-list-state.svelte';

  let { list, links }: { list: ChatListState; links: PhotoLinksCache } = $props();

  const now = new Date();
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Messaggi privati" title="Chat">
    <p>Solo tu e l'altra persona leggete i messaggi.</p>
  </ScreenHeader>

  {#if list.status === 'loading'}
    <Loader label="Carico le chat…" />
  {:else if list.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare le chat">
      <Button variant="ghost" onclick={() => list.refresh()}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if list.conversations.length === 0}
    <EmptyState icon="chat" title="Ancora nessuna chat">
      <p>Apri il profilo di qualcuno e premi "Invia messaggio".</p>
    </EmptyState>
  {:else}
    <ul class="list">
      {#each list.conversations as conversation (conversation.id)}
        <li animate:flip={{ duration: duration('base') }}>
          <a class="link" href={hrefTo({ name: 'conversazione', id: conversation.id })}>
            <Surface highlighted={conversation.unread > 0}>
              <div class="row">
                <Avatar name={conversation.other.nickname} src={links.get(conversation.other.avatarId)?.thumbnailUrl} />
                <div class="text">
                  <div class="top">
                    <span class="nickname">{conversation.other.nickname}</span>
                    <span class="when">{formatRelative(conversation.last.at, now)}</span>
                  </div>
                  <div class="bottom">
                    <span class="preview" class:unread={conversation.unread > 0}>{previewOf(conversation.last)}</span>
                    {#if conversation.unread > 0}<span class="badge">{conversation.unread}</span>{/if}
                  </div>
                </div>
              </div>
            </Surface>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Screen>

<style>
  .list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    list-style: none;
  }

  .link {
    display: block;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .text {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    min-width: 0;
  }

  .top,
  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .nickname {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: var(--weight-black);
  }

  .when {
    flex: none;
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
  }

  .preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .preview.unread {
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }

  .badge {
    flex: none;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    background: var(--gradient-party);
    color: var(--color-on-accent);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    line-height: 22px;
    text-align: center;
  }
</style>
