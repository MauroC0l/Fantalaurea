import type { AlbumPhoto, EveningAdmin, NamedFile, PhotoDeletion, PhotoExporter, WriteFailure } from '../../application/ports';
import type { AdminSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

// Hundreds of downloads at once make some of them fail: a few at a time, each retried.
const PARALLEL_DOWNLOADS = 6;
const ATTEMPTS = 3;
// Windows refuses to extract paths longer than 260 characters: a 300-character caption can't go in the name.
const TITLE_IN_NAME_MAX = 30;

export interface Preparation {
  readonly done: number;
  readonly total: number;
}

/**
 * The admin's photo album. Sharing needs the files already in memory, because browsers only
 * allow it straight from a tap: downloading dozens of photos first would take too long.
 */
export class AlbumState {
  status = $state<LoadStatus>('loading');
  photos = $state.raw<readonly AlbumPhoto[]>([]);
  preparation = $state.raw<Preparation | null>(null);
  prepared = $state.raw<readonly NamedFile[] | null>(null);

  readonly exporter: PhotoExporter;
  readonly #admin: EveningAdmin;
  readonly #session: AdminSession;

  constructor(deps: { admin: EveningAdmin; exporter: PhotoExporter }, session: AdminSession) {
    this.#admin = deps.admin;
    this.exporter = deps.exporter;
    this.#session = session;
  }

  async load(): Promise<Result<void, WriteFailure>> {
    this.status = 'loading';
    const album = await this.#admin.album(this.#session);
    if (!album.ok) {
      this.status = 'failed';
      return album;
    }
    this.photos = album.value;
    this.prepared = null;
    this.status = 'ready';
    return { ok: true, value: undefined };
  }

  async prepareAll(): Promise<void> {
    const photos = this.photos;
    this.preparation = { done: 0, total: photos.length };
    try {
      const names = uniqueFileNames(photos);
      const files: NamedFile[] = new Array(photos.length);
      let next = 0;
      const worker = async () => {
        while (next < photos.length) {
          const index = next++;
          files[index] = await withRetries(() => this.fetch(photos[index], names[index]));
          this.preparation = { done: (this.preparation?.done ?? 0) + 1, total: photos.length };
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
      this.prepared = files;
    } finally {
      this.preparation = null;
    }
  }

  async fetch(photo: AlbumPhoto, name = fileNameOf(photo)): Promise<NamedFile> {
    const response = await fetch(photo.fullUrl);
    if (!response.ok) throw new Error(`photo ${photo.id}: ${response.status}`);
    return { name, blob: await response.blob() };
  }

  async delete(photo: AlbumPhoto): Promise<Result<PhotoDeletion, WriteFailure>> {
    const result = await this.#admin.deletePhoto(this.#session, photo.id);
    if (result.ok) {
      this.photos = this.photos.filter((p) => p.id !== photo.id);
      this.prepared = null;
    }
    return result;
  }
}

function fileNameOf(photo: AlbumPhoto): string {
  const time = photo.takenAt.toTimeString().slice(0, 5).replace(':', '');
  const title = slug(photo.title).slice(0, TITLE_IN_NAME_MAX).replace(/-$/, '');
  return [`fantalaurea-${slug(photo.nickname)}`, title, time].filter(Boolean).join('-') + '.jpg';
}

async function withRetries<T>(task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

function uniqueFileNames(photos: readonly AlbumPhoto[]): string[] {
  const seen = new Map<string, number>();
  return photos.map((photo) => {
    const name = fileNameOf(photo);
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : name.replace(/\.jpg$/, `-${count + 1}.jpg`);
  });
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
