import type { AlbumPhoto, EveningAdmin, NamedFile, PhotoDeletion, PhotoExporter, WriteFailure } from '../../application/ports';
import type { AdminSession } from '../../domain/player';
import type { Result } from '../../domain/result';
import type { LoadStatus } from '../game/game-state.svelte';

// Hundreds of downloads at once make some of them fail: a few at a time, each retried.
const PARALLEL_DOWNLOADS = 6;
const ATTEMPTS = 3;
// Windows refuses to extract paths longer than 260 characters: a 300-character caption can't go in the name.
const TITLE_IN_NAME_MAX = 30;
// Real photos weigh about 1.5 MB: a whole evening in memory at once would crash a phone's browser.
export const EXPORT_PART_SIZE = 100;
const BETWEEN_DOWNLOADS_MS = 800;

export interface Preparation {
  readonly part: number;
  readonly done: number;
  readonly total: number;
}

/** Photos from..to (1-based) of the album, saved together. */
export interface ExportPart {
  readonly index: number;
  readonly from: number;
  readonly to: number;
}

/**
 * The admin's photo album. Sharing needs the files already in memory, because browsers only
 * allow it straight from a tap: downloading dozens of photos first would take too long.
 */
export class AlbumState {
  status = $state<LoadStatus>('loading');
  photos = $state.raw<readonly AlbumPhoto[]>([]);
  preparation = $state.raw<Preparation | null>(null);
  /** One part at a time in memory: preparing another one lets the previous go. */
  prepared = $state.raw<{ readonly part: number; readonly files: readonly NamedFile[] } | null>(null);

  readonly parts = $derived.by((): readonly ExportPart[] =>
    Array.from({ length: Math.ceil(this.photos.length / EXPORT_PART_SIZE) }, (_, index) => ({
      index,
      from: index * EXPORT_PART_SIZE + 1,
      to: Math.min((index + 1) * EXPORT_PART_SIZE, this.photos.length),
    })),
  );

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

  /**
   * Every part as a ZIP, one after the other, each released before the next: one tap for the whole
   * album. The pause lets the browser handle one download before the next one starts.
   */
  async downloadAll(): Promise<void> {
    for (const part of this.parts) {
      await this.prepare(part.index);
      if (!this.prepared) return;
      this.exporter.downloadZip(this.prepared.files, this.zipName(part.index));
      this.prepared = null;
      await new Promise((resolve) => setTimeout(resolve, BETWEEN_DOWNLOADS_MS));
    }
  }

  zipName(part: number): string {
    return this.parts.length === 1 ? 'fantalaurea-foto.zip' : `fantalaurea-foto-parte-${part + 1}-di-${this.parts.length}.zip`;
  }

  async prepare(part: number): Promise<void> {
    const start = part * EXPORT_PART_SIZE;
    // Names are made unique over the whole album, so parts never collide once extracted together.
    const names = uniqueFileNames(this.photos).slice(start, start + EXPORT_PART_SIZE);
    const photos = this.photos.slice(start, start + EXPORT_PART_SIZE);
    this.prepared = null;
    this.preparation = { part, done: 0, total: photos.length };
    try {
      const files: NamedFile[] = new Array(photos.length);
      let next = 0;
      const worker = async () => {
        while (next < photos.length) {
          const index = next++;
          files[index] = await withRetries(() => this.fetch(photos[index], names[index]));
          this.preparation = { part, done: (this.preparation?.done ?? 0) + 1, total: photos.length };
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker));
      this.prepared = { part, files };
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
