import type { PhotoProcessor, PhotoShape, PreparedPhoto } from '../../application/ports';

export interface PhotoQuality {
  readonly maxEdge: number;
  readonly jpegQuality: number;
}

export interface ShapeQuality {
  readonly full: PhotoQuality;
  readonly thumbnail: PhotoQuality;
}

interface Decoded {
  readonly source: ImageBitmap | HTMLImageElement;
  readonly width: number;
  readonly height: number;
  release(): void;
}

/** Decodes any image the browser understands (incl. iPhone HEIC in Safari) and re-encodes it as JPEG. */
export function canvasPhotoProcessor(qualities: Readonly<Record<PhotoShape, ShapeQuality>>): PhotoProcessor {
  return {
    async prepare(file: File, shape: PhotoShape): Promise<PreparedPhoto> {
      const image = await decode(file);
      const { full, thumbnail } = qualities[shape];
      const square = shape === 'square';
      try {
        return { full: await encode(image, full, square), thumbnail: await encode(image, thumbnail, square) };
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

/** A square crop keeps the centre of the photo, like a profile picture. */
function encode(image: Decoded, quality: PhotoQuality, square: boolean): Promise<Blob> {
  const side = Math.min(image.width, image.height);
  const source = square
    ? { x: (image.width - side) / 2, y: (image.height - side) / 2, width: side, height: side }
    : { x: 0, y: 0, width: image.width, height: image.height };
  const scale = Math.min(1, quality.maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('canvas unavailable'));
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.source, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encoding failed'))), 'image/jpeg', quality.jpegQuality),
  );
}
