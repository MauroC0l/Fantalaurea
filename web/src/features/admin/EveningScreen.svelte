<script lang="ts">
  import { BASE_PATH } from '../routes';
  import type { Clipboard, PhotoExporter, WriteFailure } from '../../application/ports';
  import type { Result } from '../../domain/result';
  import Button from '../../ui/components/Button.svelte';
  import Dialog from '../../ui/components/Dialog.svelte';
  import ScrollArea from '../../ui/components/ScrollArea.svelte';
  import Icon from '../../ui/components/Icon.svelte';
  import IconButton from '../../ui/components/IconButton.svelte';
  import Screen from '../../ui/components/Screen.svelte';
  import ScreenHeader from '../../ui/components/ScreenHeader.svelte';
  import SegmentedControl from '../../ui/components/SegmentedControl.svelte';
  import Surface from '../../ui/components/Surface.svelte';
  import Switch from '../../ui/components/Switch.svelte';
  import TextField from '../../ui/components/TextField.svelte';
  import type { FeatureName } from '../../domain/features';
  import { toasts } from '../../ui/components/toasts.svelte';
  import { describeDevice } from '../labels';
  import type { AdminState } from './admin-state.svelte';

  interface Props {
    admin: AdminState;
    clipboard: Clipboard;
    exporter: PhotoExporter;
    onlogout: () => void;
    onunauthorized: () => void;
    onopenalbum: () => void;
  }

  let { admin, clipboard, exporter, onlogout, onunauthorized, onopenalbum }: Props = $props();

  type OpenDialog =
    | { kind: 'none' }
    | { kind: 'change-word' }
    | { kind: 'photos-reminder'; photoCount: number }
    | { kind: 'reset' };

  type WhoIsInside = 'stay' | 'out';

  const INSIDE_OPTIONS: readonly { value: WhoIsInside; label: string }[] = [
    { value: 'stay', label: 'Restano dentro' },
    { value: 'out', label: 'Devono rientrare' },
  ];

  let dialog = $state<OpenDialog>({ kind: 'none' });
  let busy = $state(false);
  let newWord = $state('');
  let inside = $state<WhoIsInside>('stay');
  let wordError = $state<string>();

  const close = () => (dialog = { kind: 'none' });

  const FEATURES: readonly { name: FeatureName; label: string; description: string }[] = [
    { name: 'actions', label: 'Azioni', description: 'La lista delle azioni da completare' },
    { name: 'feed', label: 'Bacheca', description: 'Post, foto delle azioni e like visibili a tutti' },
    { name: 'chat', label: 'Chat', description: 'Messaggi privati, foto e vocali tra giocatori' },
    { name: 'leaderboard', label: 'Classifica', description: 'Chi è in testa. I punti restano comunque' },
    { name: 'polls', label: 'Sondaggi', description: 'Li crei tu o chi abiliti in Utenti' },
  ];

  async function toggleFeature(feature: FeatureName, enabled: boolean) {
    const result = await admin.setFeature(feature, enabled);
    if (!result.ok) report(result.error);
  }

  function report(failure: WriteFailure) {
    if (failure === 'unauthorized') onunauthorized();
    else toasts.show('Operazione non riuscita: riprova', 'error');
  }

  async function run<T>(operation: () => Promise<Result<T, WriteFailure>>, success: string): Promise<boolean> {
    busy = true;
    const result = await operation();
    busy = false;
    if (!result.ok) {
      report(result.error);
      return false;
    }
    toasts.show(success);
    return true;
  }

  function invitation(word: string): string {
    return `Fantalaurea: la parola della serata è «${word}». Entra da ${location.origin}${BASE_PATH}`;
  }

  async function copy() {
    if (admin.secretWord && (await clipboard.copy(admin.secretWord))) toasts.show('Parola copiata');
    else toasts.show('Non riesco a copiarla: tienila premuta per selezionarla', 'error');
  }

  async function share() {
    if (!admin.secretWord) return;
    const outcome = await exporter.shareText(invitation(admin.secretWord));
    if (outcome === 'unsupported') await copy();
  }

  function openChangeWord() {
    newWord = '';
    inside = 'stay';
    wordError = undefined;
    dialog = { kind: 'change-word' };
  }

  async function changeWord(word: string | null) {
    if (word !== null && word.replace(/[^\p{L}\p{N}]/gu, '').length < 3) {
      wordError = 'Almeno 3 lettere o numeri';
      return;
    }
    const changed = await run(
      () => admin.setSecretWord(word, inside === 'out'),
      inside === 'out' ? 'Parola cambiata: tutti devono rientrare' : 'Parola cambiata',
    );
    if (changed) close();
  }

  /** Photos are deleted with the evening: remind to save them first (only if there are any). */
  async function askToReset() {
    busy = true;
    const count = await admin.photoCount();
    busy = false;
    if (!count.ok) return report(count.error);
    dialog = count.value > 0 ? { kind: 'photos-reminder', photoCount: count.value } : { kind: 'reset' };
  }

  async function reset() {
    if (await run(() => admin.resetEvening(), 'Serata azzerata: nuova parola pronta!')) close();
  }
</script>

<Screen withTabBar>
  <ScreenHeader eyebrow="Pannello admin" title="La serata">
    <p>{admin.participantCount === 1 ? '1 partecipante' : `${admin.participantCount} partecipanti`}</p>
    {#snippet trailing()}
      <IconButton icon="logout" label="Esci dal pannello" onclick={onlogout} />
    {/snippet}
  </ScreenHeader>

  <Surface tone="common" highlighted>
    <div class="word">
      <p class="label"><Icon name="key" size={16} /> Parola della serata</p>
      <p class="secret">{admin.secretWord ?? '…'}</p>
      <div class="buttons">
        <Button size="small" onclick={share}><Icon name="share" size={16} /> Condividi</Button>
        <Button size="small" variant="ghost" onclick={copy}><Icon name="copy" size={16} /> Copia</Button>
        <Button size="small" variant="ghost" onclick={openChangeWord}><Icon name="pencil" size={16} /> Cambia</Button>
      </div>
    </div>
  </Surface>

  <section class="section">
    <h2>Funzioni della serata</h2>
    <Surface>
      <div class="switches">
        {#each FEATURES as feature (feature.name)}
          <Switch
            checked={admin.features[feature.name]}
            label={feature.label}
            description={feature.description}
            onchange={(enabled) => toggleFeature(feature.name, enabled)}
          />
        {/each}
      </div>
    </Surface>
  </section>

  <section class="section">
    <h2>Accessi admin <span class="count">{admin.accessLog.length}</span></h2>
    <p class="muted">Ogni ingresso con le credenziali admin. Se ne vedi uno che non è tuo, cambia la parola.</p>
    <ScrollArea maxHeight="min(360px, 45dvh)" label="Accessi admin">
    <ul class="log">
      {#each admin.accessLog as entry, index (index)}
        <li>
          <Surface>
            <p class="when">{entry.at.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</p>
            <p class="device">{describeDevice(entry.device)}</p>
          </Surface>
        </li>
      {:else}
        <li class="muted">Nessun accesso registrato.</li>
      {/each}
    </ul>
    </ScrollArea>
  </section>

  <section class="section">
    <h2>Fine serata</h2>
    <Surface tone="malus" highlighted>
      <div class="danger-zone">
        <p>
          Cancella partecipanti, azioni segnate, post, foto e log, e genera una nuova parola. La lista delle azioni
          resta.
        </p>
        <Button variant="danger" block loading={busy} onclick={askToReset}>Termina e ricomincia</Button>
      </div>
    </Surface>
  </section>
</Screen>

{#snippet changeWordActions()}
  <Button block loading={busy} onclick={() => changeWord(newWord)}>Usa questa parola</Button>
  <Button block variant="ghost" disabled={busy} onclick={() => changeWord(null)}>
    <Icon name="sparkle" size={18} /> Generane una nuova
  </Button>
  <Button block variant="ghost" disabled={busy} onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'change-word'} title="Cambia la parola" onclose={close} actions={changeWordActions}>
  <TextField name="new-word" label="Nuova parola" maxlength={40} autocapitalize="none" error={wordError} bind:value={newWord} />
  <div class="field">
    <p class="label">Chi è già dentro</p>
    <SegmentedControl label="Chi è già dentro" options={INSIDE_OPTIONS} bind:value={inside} />
    <p class="muted">
      {inside === 'out'
        ? 'Tutti i giocatori escono e rientrano con la nuova parola. Azioni e foto restano.'
        : 'Chi è già dentro continua a giocare; la nuova parola vale per chi entra da ora.'}
    </p>
  </div>
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
      Nell'album ci sono <strong>{dialog.photoCount} foto</strong>. Terminando la serata verranno cancellate per sempre:
      prima scaricale o condividile dall'album.
    </p>
  {/if}
</Dialog>

{#snippet confirmReset()}
  <Button variant="danger" block loading={busy} onclick={reset}>Sì, ricomincia da zero</Button>
  <Button variant="ghost" block onclick={close}>Annulla</Button>
{/snippet}

<Dialog open={dialog.kind === 'reset'} title="Terminare la serata?" onclose={close} actions={confirmReset}>
  <p>
    Partecipanti, azioni segnate, post, foto e log verranno cancellati. Chi è dentro dovrà rientrare con la nuova parola.
    Non si può annullare.
  </p>
</Dialog>

<style>
  .word {
    display: grid;
    gap: var(--space-3);
  }

  .label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-common);
    font-size: var(--text-xs);
    font-weight: var(--weight-black);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .secret {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: var(--weight-black);
    overflow-wrap: anywhere;
    user-select: all;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

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

  .count,
  .muted {
    color: var(--color-text-subtle);
  }

  .muted {
    font-size: var(--text-sm);
  }

  .switches {
    display: grid;
    gap: var(--space-3);
  }

  .log {
    display: grid;
    gap: var(--space-2);
    list-style: none;
  }

  .when {
    font-weight: var(--weight-black);
  }

  .device {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }

  .field {
    display: grid;
    gap: var(--space-2);
  }

  .field .label {
    color: var(--color-text);
    letter-spacing: normal;
    text-transform: none;
    font-size: var(--text-sm);
  }

  .danger-zone {
    display: grid;
    gap: var(--space-4);
    color: var(--color-text-muted);
  }
</style>
