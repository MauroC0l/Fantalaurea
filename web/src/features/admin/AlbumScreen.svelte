<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { AlbumPhoto, NamedFile } from '../../application/ports';
  import Avatar from '../../ui/components/Avatar.svelte';
  import Badge from '../../ui/components/Badge.svelte';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import EmptyState from '../../ui/components/EmptyState.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Lightbox from '../../ui/components/Lightbox.svelte';
  import Loader from '../../ui/components/Loader.svelte';
  import ProgressBar from '../../ui/components/ProgressBar.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import Thumbnail from '../../ui/components/Thumbnail.svelte';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { duration, easing, stagger } from '../../ui/theme/motion';
  import { formatDateTime } from '../labels';
  import { EXPORT_PART_SIZE, type AlbumState } from './album-state.svelte';

  interface Props {
    album: AlbumState;
    onunauthorized: () => void;
  }

  let { album, onunauthorized }: Props = $props();

  let viewing = $state<{ photo: AlbumPhoto; file: NamedFile | null } | null>(null);
  let confirmingDelete = $state(false);
  /** The "save everything" dialog: explanation, automatic ZIPs, or one share per group (iPhone). */
  let saving = $state<{ step: 'explain' | 'zip' | 'share' } | null>(null);

  const zipCount = $derived(album.parts.length);
  const busyExporting = $derived(album.preparation !== null || saving?.step === 'zip');

  async function downloadAll() {
    saving = { step: 'zip' };
    try {
      await album.downloadAll();
      toasts.show(zipCount === 1 ? 'ZIP scaricato' : `Fatto: ${zipCount} ZIP scaricati`);
      saving = null;
    } catch {
      toasts.show('Non sono riuscito a scaricare tutte le foto: riprova', 'error');
      saving = { step: 'explain' };
    }
  }
  let deleting = $state(false);

  const canShareOne = $derived(viewing?.file ? album.exporter.canShare([viewing.file]) : false);
  const viewingIndex = $derived(viewing ? album.photos.findIndex((p) => p.id === viewing?.photo.id) : -1);
  const hasPrevious = $derived(viewingIndex > 0);
  const hasNext = $derived(viewingIndex >= 0 && viewingIndex < album.photos.length - 1);

  function step(offset: 1 | -1) {
    const target = album.photos[viewingIndex + offset];
    if (target) void open(target);
  }

  onMount(() => void load());

  async function load() {
    const result = await album.load();
    if (!result.ok && result.error === 'unauthorized') onunauthorized();
  }

  async function prepare(part: number) {
    try {
      await album.prepare(part);
    } catch {
      toasts.show('Non sono riuscito a scaricare tutte le foto: riprova', 'error');
    }
  }

  async function share(files: readonly NamedFile[]) {
    try {
      if ((await album.exporter.share(files)) === 'shared') toasts.show('Foto condivise');
    } catch {
      toasts.show('Condivisione non riuscita: prova con "Scarica"', 'error');
    }
  }

  async function open(photo: AlbumPhoto) {
    viewing = { photo, file: null };
    // Fetch now: sharing must happen right on the tap, with the file already in memory.
    try {
      const file = await album.fetch(photo);
      if (viewing?.photo.id === photo.id) viewing = { photo, file };
    } catch {
      // The lightbox still shows the photo; sharing and saving stay disabled.
    }
  }

  async function deleteViewed() {
    if (!viewing) return;
    const index = viewingIndex;
    deleting = true;
    const result = await album.delete(viewing.photo);
    deleting = false;
    confirmingDelete = false;
    if (!result.ok) {
      if (result.error === 'unauthorized') onunauthorized();
      else toasts.show('Eliminazione non riuscita: riprova', 'error');
      return;
    }
    // Keep browsing: show the photo that took its place, if any.
    const next = album.photos[Math.min(index, album.photos.length - 1)];
    viewing = null;
    if (next) void open(next);
    toasts.show(result.value.undone ? 'Foto eliminata: l’azione è stata annullata' : 'Foto eliminata');
  }
</script>

<Screen withTabBar wide>
  <ScreenHeader eyebrow="Solo per l'admin" title="Album">
    <p>{album.photos.length === 1 ? '1 foto' : `${album.photos.length} foto`} della serata</p>
    {#snippet trailing()}
      <IconButton icon="refresh" label="Aggiorna" onclick={load} />
    {/snippet}
  </ScreenHeader>

  {#if album.status === 'loading'}
    <Loader label="Sviluppo le foto…" />
  {:else if album.status === 'failed'}
    <EmptyState icon="alert" title="Non riesco a caricare l'album">
      <Button variant="ghost" onclick={load}><Icon name="refresh" size={20} /> Riprova</Button>
    </EmptyState>
  {:else if album.photos.length === 0}
    <EmptyState icon="image" title="Ancora nessuna foto">
      <p>Le foto delle azioni e dei post compariranno qui.</p>
    </EmptyState>
  {:else}
    <Surface>
      <div class="export">
        <p class="export-title">Salva tutte le foto</p>
        <Button block onclick={() => (saving = { step: 'explain' })}>
          <Icon name="download" size={20} /> Scarica tutte ({album.photos.length})
        </Button>
      </div>
    </Surface>

    <ul class="grid">
      {#each album.photos as photo, index (photo.id)}
        <li in:fly={{ y: 16, duration: duration('base'), delay: stagger(index, 25), easing }}>
          <Thumbnail src={photo.thumbnailUrl} alt="{photo.title}, di {photo.nickname}" onclick={() => open(photo)} />
          <p class="caption">{photo.nickname}</p>
        </li>
      {/each}
    </ul>
  {/if}
</Screen>

{#snippet savingActions()}
  {#if saving?.step === 'explain'}
    <Button block onclick={downloadAll}>
      <Icon name="download" size={20} /> {zipCount === 1 ? 'Scarica lo ZIP' : `Scarica ${zipCount} ZIP`}
    </Button>
    <Button block variant="ghost" onclick={() => (saving = { step: 'share' })}>
      <Icon name="share" size={20} /> Salva nel rullino (iPhone)
    </Button>
    <Button block variant="ghost" onclick={() => (saving = null)}>Annulla</Button>
  {:else if saving?.step === 'share'}
    <Button block variant="ghost" disabled={album.preparation !== null} onclick={() => (saving = null)}>Chiudi</Button>
  {/if}
{/snippet}

<Dialog
  open={saving !== null}
  title={saving?.step === 'share' ? 'Salva nel rullino' : `Scaricare ${album.photos.length} foto?`}
  onclose={() => !busyExporting && (saving = null)}
  actions={savingActions}
>
  {#if saving?.step === 'explain'}
    {#if zipCount === 1}
      <p>Le metto tutte in un file ZIP, che trovi nei download.</p>
    {:else}
      <p>
        Le scarico in <strong>{zipCount} file ZIP</strong> da massimo {EXPORT_PART_SIZE} foto, uno dopo l’altro, da solo.
        Tutte insieme occuperebbero troppa memoria e il telefono chiuderebbe la pagina.
      </p>
      <p>Se il browser chiede il permesso di scaricare più file, accetta.</p>
    {/if}
  {:else if saving?.step === 'zip'}
    {#if album.preparation}
      <p>ZIP {album.preparation.part + 1} di {zipCount}: {album.preparation.done}/{album.preparation.total} foto</p>
      <ProgressBar value={album.preparation.done} max={album.preparation.total} label="Foto preparate" />
    {:else}
      <p>Salvo lo ZIP…</p>
    {/if}
  {:else if saving?.step === 'share'}
    <p>
      Su iPhone le foto arrivano nel rullino solo da "Condividi" → "Salva immagini", e ogni condivisione vuole un tocco:
      per questo sono a gruppi di {EXPORT_PART_SIZE}.
    </p>
    {#each album.parts as part (part.index)}
      <div class="part">
        <p class="part-title">{zipCount === 1 ? 'Tutte le foto' : `Gruppo ${part.index + 1} · foto ${part.from}–${part.to}`}</p>
        {#if album.preparation?.part === part.index}
          <ProgressBar value={album.preparation.done} max={album.preparation.total} label="Foto preparate" />
        {:else if album.prepared?.part === part.index}
          {@const files = album.prepared.files}
          <Button block onclick={() => share(files)}><Icon name="share" size={20} /> Condividi {files.length} foto</Button>
        {:else}
          <Button block variant="ghost" disabled={album.preparation !== null} onclick={() => prepare(part.index)}>
            Prepara il gruppo
          </Button>
        {/if}
      </div>
    {/each}
  {/if}
</Dialog>

<Lightbox
  src={viewing?.photo.fullUrl ?? null}
  alt={viewing ? `${viewing.photo.title}, di ${viewing.photo.nickname}` : ''}
  onclose={() => (viewing = null)}
  onprevious={hasPrevious ? () => step(-1) : undefined}
  onnext={hasNext ? () => step(1) : undefined}
  position={viewingIndex >= 0 ? `${viewingIndex + 1} di ${album.photos.length}` : undefined}
>
  {#snippet caption()}
    {#if viewing}
      <div class="details">
        <div class="details-head">
          <Badge tone="neutral">{viewing.photo.source === 'post' ? 'Post in bacheca' : 'Azione'}</Badge>
          <span class="when"><Icon name="clock" size={14} /> {formatDateTime(viewing.photo.takenAt)}</span>
        </div>
        {#if viewing.photo.source === 'action'}
          <p class="lightbox-title">{viewing.photo.title}</p>
        {/if}
        <div class="author">
          <Avatar name={viewing.photo.nickname} size="sm" />
          <span class="names">
            <span class="nickname">{viewing.photo.nickname}</span>
            <span class="real-name">{viewing.photo.realName}</span>
          </span>
        </div>
        {#if viewing.photo.source === 'post' && viewing.photo.title}
          <p class="post-caption">{viewing.photo.title}</p>
        {/if}
      </div>
    {/if}
  {/snippet}
  {#snippet actions()}
    {#if viewing}
      {@const file = viewing.file}
      {#if canShareOne}
        <Button size="small" disabled={!file} onclick={() => file && share([file])}>
          <Icon name="share" size={16} /> Condividi
        </Button>
      {/if}
      <Button size="small" variant="ghost" disabled={!file} onclick={() => file && album.exporter.download(file)}>
        <Icon name="download" size={16} /> Scarica
      </Button>
      <Button size="small" variant="danger" onclick={() => (confirmingDelete = true)}>
        <Icon name="trash" size={16} /> Elimina
      </Button>
    {/if}
  {/snippet}
</Lightbox>

{#snippet deleteActions()}
  <Button variant="danger" block loading={deleting} onclick={deleteViewed}>Elimina la foto</Button>
  <Button variant="ghost" block onclick={() => (confirmingDelete = false)}>Annulla</Button>
{/snippet}

<Dialog open={confirmingDelete} title="Eliminare la foto?" onclose={() => (confirmingDelete = false)} actions={deleteActions}>
  <p>Se è il post di qualcuno, il post sparisce dalla bacheca. Se era la foto obbligatoria di un'azione, l'azione viene annullata per chi l'ha scattata.</p>
</Dialog>

<style>
  .export {
    display: grid;
    gap: var(--space-3);
  }

  .export-title {
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
  }

  .part {
    display: grid;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
  }


  .part-title {
    color: var(--color-text);
    font-weight: var(--weight-bold);
  }



  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
    list-style: none;
  }

  @media (min-width: 700px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
  }

  .caption {
    margin-top: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .details {
    display: grid;
    gap: var(--space-3);
  }

  .details-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .when {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .lightbox-title {
    color: var(--color-text);
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: var(--weight-black);
    line-height: var(--leading-tight);
    overflow-wrap: anywhere;
  }

  /* A caption is text to read, not a heading: it can be three hundred characters long. */
  .post-caption {
    color: var(--color-text);
    line-height: var(--leading-normal);
    overflow-wrap: anywhere;
  }

  .author {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .names {
    display: grid;
  }

  .nickname {
    color: var(--color-text);
    font-weight: var(--weight-black);
  }

  .real-name {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
