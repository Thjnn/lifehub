const MAX_SIDE = 1024

/**
 * Shrinks a meal photo in the browser (longest side 1024px, JPEG) so only ~100–200 KB go to the API and on to Gemini.
 * Returned as a data URL, like the avatar. The photo is never stored anywhere.
 */
export async function toScanDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một file ảnh.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file) // respects EXIF rotation in current browsers
  } catch {
    throw new Error('Không đọc được ảnh này. Thử chụp lại hoặc chọn ảnh JPG/PNG khác.')
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) })
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', 0.8)
}
