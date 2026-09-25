import type { AlbumPhoto, EveningAdmin, NamedFile, PhotoDeletion, PhotoExporter, WriteFailure } from '../../application/ports';
import type { AdminSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

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
      this.prepared = await Promise.all(
        photos.map(async (photo, index) => {
          const file = await this.fetch(photo, names[index]);
          this.preparation = { done: (this.preparation?.done ?? 0) + 1, total: photos.length };
          return file;
        }),
      );
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
  return `fantalaurea-${slug(photo.nickname)}-${slug(photo.title)}-${time}.jpg`;
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
