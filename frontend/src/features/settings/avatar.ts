const SIZE = 256

/**
 * Center-crops a picked photo to a 256px square and compresses it in the browser, so only ~10–20 KB reach the API
 * (stored as a data URL — Render has no disk). WebP where the browser can encode it, JPEG otherwise.
 */
export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một file ảnh.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file) // respects EXIF rotation in current browsers
  } catch {
    throw new Error('Không đọc được ảnh này. Thử ảnh JPG hoặc PNG khác.')
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()

  const webp = canvas.toDataURL('image/webp', 0.85)
  // Browsers that can't encode WebP silently return PNG, which is much larger for photos.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
}
