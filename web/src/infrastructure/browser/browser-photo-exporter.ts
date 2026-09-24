import { zip } from 'fflate';
import type { NamedFile, PhotoExporter } from '../../application/ports';

export function browserPhotoExporter(): PhotoExporter {
  return {
    canShare(files) {
      return typeof navigator.canShare === 'function' && navigator.canShare({ files: toFiles(files) });
    },

    async share(files) {
      try {
        await navigator.share({ files: toFiles(files) });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        throw error;
      }
    },

    download(file) {
      saveBlob(file.blob, file.name);
    },

    async downloadZip(files, zipName) {
      const entries = Object.fromEntries(
        await Promise.all(files.map(async (file) => [file.name, new Uint8Array(await file.blob.arrayBuffer())] as const)),
      );
      // JPEGs are already compressed: storing them (level 0) is as small and much faster.
      const archive = await new Promise<Uint8Array>((resolve, reject) =>
        zip(entries, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data))),
      );
      saveBlob(new Blob([archive as BlobPart], { type: 'application/zip' }), zipName);
    },
  };
}

function toFiles(files: readonly NamedFile[]): File[] {
  return files.map((file) => new File([file.blob], file.name, { type: file.blob.type || 'image/jpeg' }));
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
