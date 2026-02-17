/**
 * Compresses an image file using Canvas API.
 * Resizes to max dimension and converts to JPEG at specified quality.
 * This prevents memory issues on mobile devices when uploading large photos.
 *
 * @param {File} file - The original image file
 * @param {object} options
 * @param {number} options.maxDimension - Max width or height in px (default 1200)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.7)
 * @returns {Promise<File>} - Compressed image as a new File object
 */
export async function compressImage(file, { maxDimension = 1200, quality = 0.7 } = {}) {
  // If file is already small (< 500KB), skip compression
  if (file.size < 500 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

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

      // Convert to blob
      if (canvas instanceof OffscreenCanvas) {
        canvas.convertToBlob({ type: 'image/jpeg', quality })
          .then((blob) => {
            const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressed)
          })
          .catch(reject)
      } else {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'))
              return
            }
            const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressed)
          },
          'image/jpeg',
          quality
        )
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      // If compression fails, return original file as fallback
      resolve(file)
    }

    img.src = url
  })
}

/**
 * Compresses an image and also returns a data URL preview.
 * Useful when you need both the compressed file for upload and a preview to display.
 *
 * @param {File} file - The original image file
 * @param {object} options - Same options as compressImage
 * @returns {Promise<{file: File, preview: string}>}
 */
export async function compressImageWithPreview(file, options = {}) {
  const compressed = await compressImage(file, options)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve({ file: compressed, preview: reader.result })
    reader.readAsDataURL(compressed)
  })
}
