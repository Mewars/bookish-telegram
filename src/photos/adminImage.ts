// Client-side photo preparation: no originals, EXIF or GPS data are uploaded.
// A cover is centrally cropped to 16:9; gallery images preserve the full frame.
const MAX_INPUT = 24 * 1024 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;
const TYPES = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
const EXTENSIONS = new Set(['jpg','jpeg','png','webp','heic','heif']);

export type PhotoMode = 'cover' | 'gallery';

export interface PhotoGeometry {
  sx: number; sy: number; sw: number; sh: number; width: number; height: number;
}

export function photoGeometry(width: number, height: number, mode: PhotoMode): PhotoGeometry {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1)
    throw new Error('Некорректные размеры фотографии.');
  let sx = 0, sy = 0, sw = width, sh = height;
  if (mode === 'cover') {
    const ratio = 16 / 9;
    if (width / height > ratio) { sw = height * ratio; sx = (width - sw) / 2; }
    else { sh = width / ratio; sy = (height - sh) / 2; }
  }
  const limitW = mode === 'cover' ? 1440 : 1600;
  const limitH = mode === 'cover' ? 810 : 1200;
  const scale = Math.min(1, limitW / sw, limitH / sh);
  return { sx, sy, sw, sh, width: Math.max(1,Math.round(sw*scale)), height: Math.max(1,Math.round(sh*scale)) };
}

export function validPhotoFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return file.size > 0 && file.size <= MAX_INPUT
    && (TYPES.has(mime) || ((!mime || mime === 'application/octet-stream') && EXTENSIONS.has(ext)));
}

function decodeImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Этот браузер не открыл фотографию. Если это HEIC, попробуй JPG.')); };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve,mime,quality));
}

export async function prepareAdminImage(file: File, mode: PhotoMode = 'cover'): Promise<Blob> {
  if (!validPhotoFile(file))
    throw new Error('Выбери JPG, PNG, WebP или HEIC размером до 24 МБ.');
  const image = await decodeImage(file);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 65_000_000)
    throw new Error('Слишком большое изображение. Попробуй фотографию меньшего разрешения.');

  const geometry = photoGeometry(image.naturalWidth,image.naturalHeight,mode);
  const canvas = document.createElement('canvas');
  try {
    // Keep the aspect ratio, shrink if necessary, never upscale.
    for (const shrink of [1, 0.8, 0.6]) {
      canvas.width = Math.max(1,Math.round(geometry.width*shrink));
      canvas.height = Math.max(1,Math.round(geometry.height*shrink));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Браузер не поддерживает подготовку фотографии.');
      ctx.drawImage(image, geometry.sx,geometry.sy,geometry.sw,geometry.sh,0,0,canvas.width,canvas.height);
      // WebP is the preferred format. For browsers lacking encoder support,
      // use JPEG; both MIME types are allowed by the admin Storage bucket.
      const webp = await encode(canvas,'image/webp',0.8);
      const mime = webp?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      for (const quality of [0.8,0.65,0.5]) {
        const blob = quality === 0.8 && mime === 'image/webp' ? webp : await encode(canvas,mime,quality);
        if (blob && blob.type === mime && blob.size > 0 && blob.size <= MAX_OUTPUT) return blob;
      }
    }
    throw new Error('Не удалось уменьшить фотографию до 2 МБ. Попробуй другое изображение.');
  } finally { canvas.width = 0; canvas.height = 0; }
}

export function adminImageExtension(blob: Blob): 'webp' | 'jpg' {
  return blob.type === 'image/jpeg' ? 'jpg' : 'webp';
}
