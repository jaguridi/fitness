/**
 * Heuristic: is this device likely to OOM on a 12MP decode?
 * `navigator.deviceMemory` is a coarse hint (in GB, rounded). Returns true for
 * <= 4 GB devices, which covers most budget Androids where the "Memoria
 * insuficiente" toast happens.
 */
function isLowMemoryDevice() {
  const mem = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined
  return typeof mem === 'number' && mem <= 4
}

/**
 * Compresses an image file using Canvas API.
 * Resizes to max dimension and converts to JPEG at specified quality.
 * Aggressively releases canvas/image references to keep peak RAM low — a 12MP
 * decode costs ~48MB and budget Androids OOM with "Memoria insuficiente".
 *
 * @param {File} file - The original image file
 * @param {object} options
 * @param {number} options.maxDimension - Max width or height in px (default 1200, 900 on low-mem devices)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.7, 0.6 on low-mem)
 * @returns {Promise<File>} - Compressed image as a new File object
 */
export async function compressImage(file, options = {}) {
  const lowMem = isLowMemoryDevice()
  const maxDimension = options.maxDimension ?? (lowMem ? 900 : 1200)
  const quality = options.quality ?? (lowMem ? 0.6 : 0.7)

  // Skip only for files that are both small in bytes AND not likely to be a
  // high-MP photo. A 400KB JPEG can still be 4000×3000 and OOM on decode, so
  // we keep the skip threshold low.
  if (file.size < 200 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    let img = new Image()
    const url = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(url)
      if (img) {
        img.onload = null
        img.onerror = null
        img.src = ''
        img = null
      }
    }

    img.onload = () => {
      let { width, height } = img

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      // Use OffscreenCanvas if available (better memory on mobile), fallback to regular canvas
      let canvas
      let ctx
      try {
        canvas = new OffscreenCanvas(width, height)
        ctx = canvas.getContext('2d')
      } catch {
        canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        ctx = canvas.getContext('2d')
      }

      ctx.drawImage(img, 0, 0, width, height)
      // Release the source image as soon as it's drawn — frees the original
      // decoded bitmap (~tens of MB for high-MP photos).
      cleanup()

      const releaseCanvas = () => {
        if (!(canvas instanceof OffscreenCanvas)) {
          // Setting width to 0 forces the browser to discard the bitmap buffer
          canvas.width = 0
          canvas.height = 0
        }
        canvas = null
        ctx = null
      }

      const fileName = file.name ? file.name.replace(/\.\w+$/, '.jpg') : `photo-${Date.now()}.jpg`

      const onBlob = (blob) => {
        releaseCanvas()
        if (!blob) {
          reject(new Error('Canvas toBlob failed'))
          return
        }
        const compressed = new File([blob], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
        resolve(compressed)
      }

      if (canvas instanceof OffscreenCanvas) {
        canvas.convertToBlob({ type: 'image/jpeg', quality })
          .then(onBlob)
          .catch((err) => {
            releaseCanvas()
            reject(err)
          })
      } else {
        canvas.toBlob(onBlob, 'image/jpeg', quality)
      }
    }

    img.onerror = () => {
      cleanup()
      // If decoding failed, return original — the upload will still work,
      // we just couldn't shrink it.
      resolve(file)
    }

    img.src = url
  })
}

/**
 * Reads a File/Blob as a data URL. Rejects on FileReader error or abort so
 * callers can show a real error instead of hanging forever (which was the
 * behavior before — on low-memory Android Chrome FileReader can fail silently).
 *
 * @param {File|Blob} file
 * @returns {Promise<string>} data URL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.onabort = () => reject(new Error('FileReader aborted'))
    try {
      reader.readAsDataURL(file)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Compresses an image and also returns a data URL preview.
 * Useful when you need both the compressed file for upload and a preview to display.
 *
 * NOTE: data URLs are stored as base64 in memory, costing ~4/3× the file size
 * while the preview is held in React state. For display-only previews prefer
 * `compressImageWithObjectURL` — much cheaper RAM-wise on Android.
 *
 * @param {File} file - The original image file
 * @param {object} options - Same options as compressImage
 * @returns {Promise<{file: File, preview: string}>}
 */
export async function compressImageWithPreview(file, options = {}) {
  const compressed = await compressImage(file, options)
  const preview = await readFileAsDataURL(compressed)
  return { file: compressed, preview }
}

/**
 * Same as `compressImageWithPreview` but the preview is a blob: URL (object URL)
 * instead of a base64 data URL. The caller MUST call `URL.revokeObjectURL` on
 * the previewUrl when it's no longer needed to avoid leaking the blob in memory.
 *
 * @param {File} file - The original image file
 * @param {object} options - Same options as compressImage
 * @returns {Promise<{file: File, previewUrl: string}>}
 */
export async function compressImageWithObjectURL(file, options = {}) {
  const compressed = await compressImage(file, options)
  const previewUrl = URL.createObjectURL(compressed)
  return { file: compressed, previewUrl }
}
