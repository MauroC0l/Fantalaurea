import type { PhotoProcessor, PreparedPhoto } from '../../application/ports';

export interface PhotoQuality {
  readonly maxEdge: number;
  readonly jpegQuality: number;
}

interface Decoded {
  readonly source: ImageBitmap | HTMLImageElement;
  readonly width: number;
  readonly height: number;
  release(): void;
}

/** Decodes any image the browser understands (incl. iPhone HEIC in Safari) and re-encodes it as JPEG. */
export function canvasPhotoProcessor(full: PhotoQuality, thumbnail: PhotoQuality): PhotoProcessor {
  return {
    async prepare(file: File): Promise<PreparedPhoto> {
      const image = await decode(file);
      try {
        return { full: await encode(image, full), thumbnail: await encode(image, thumbnail) };
      } finally {
        image.release();
      }
    },
  };
}

async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Older Safari cannot build a bitmap from some formats but can still show them in an <img>.
    return decodeWithImageElement(file);
  }
}

async function decodeWithImageElement(file: File): Promise<Decoded> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function encode(image: Decoded, quality: PhotoQuality): Promise<Blob> {
  const scale = Math.min(1, quality.maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('canvas unavailable'));
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encoding failed'))), 'image/jpeg', quality.jpegQuality),
  );
}
