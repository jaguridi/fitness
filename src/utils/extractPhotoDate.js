/**
 * Extracts the date a photo was taken from its EXIF metadata.
 * Works with JPEG files that contain EXIF data.
 * Falls back gracefully — returns null if no date can be extracted.
 *
 * Reads DateTimeOriginal (tag 0x9003) or DateTime (tag 0x0132) from EXIF.
 */

/**
 * @param {File} file - Image file to extract date from
 * @returns {Promise<{date: string, datetime: Date}|null>} - { date: 'YYYY-MM-DD', datetime: Date } or null
 */
export async function extractPhotoDate(file) {
  try {
    // Only attempt for JPEG files (EXIF is typically in JPEG)
    if (!file.type || (!file.type.includes('jpeg') && !file.type.includes('jpg'))) {
      // Try anyway — some phones save as image/jpeg with different extensions
      // Fall through to attempt reading
    }

    const buffer = await readFileSlice(file, 0, 128 * 1024) // Read first 128KB (EXIF is at the start)
    const view = new DataView(buffer)

    // Check JPEG SOI marker
    if (view.getUint16(0) !== 0xFFD8) return null

    let offset = 2
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset)
      if (marker === 0xFFE1) {
        // APP1 — EXIF data
        const length = view.getUint16(offset + 2)
        const exifStart = offset + 4

        // Check "Exif\0\0" header
        if (
          view.getUint8(exifStart) === 0x45 && // E
          view.getUint8(exifStart + 1) === 0x78 && // x
          view.getUint8(exifStart + 2) === 0x69 && // i
          view.getUint8(exifStart + 3) === 0x66 && // f
          view.getUint8(exifStart + 4) === 0x00 &&
          view.getUint8(exifStart + 5) === 0x00
        ) {
          const tiffStart = exifStart + 6
          const dateStr = parseTiff(view, tiffStart, tiffStart + length - 6)
          if (dateStr) {
            return parseExifDateString(dateStr)
          }
        }

        offset += 2 + length
      } else if ((marker & 0xFF00) === 0xFF00) {
        // Other marker — skip
        if (marker === 0xFFDA) break // Start of scan — no more metadata
        const len = view.getUint16(offset + 2)
        offset += 2 + len
      } else {
        break
      }
    }

    // If no EXIF date found, try file's lastModified as a loose fallback
    if (file.lastModified) {
      const d = new Date(file.lastModified)
      if (!isNaN(d.getTime())) {
        return {
          date: formatDate(d),
          datetime: d,
          source: 'file_modified',
        }
      }
    }

    return null
  } catch (err) {
    console.warn('EXIF extraction failed:', err)
    return null
  }
}

function readFileSlice(file, start, end) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    const slice = file.slice(start, Math.min(end, file.size))
    reader.readAsArrayBuffer(slice)
  })
}

function parseTiff(view, tiffStart, maxOffset) {
  const clampedMax = Math.min(maxOffset, view.byteLength)

  // Byte order
  const byteOrder = view.getUint16(tiffStart)
  const littleEndian = byteOrder === 0x4949 // "II" = Intel = little-endian

  // First IFD offset
  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian)
  const ifd0Start = tiffStart + ifdOffset

  // Search IFD0 for DateTimeOriginal (in sub-IFD) or DateTime
  let dateTime = null
  let exifIfdOffset = null

  if (ifd0Start + 2 >= clampedMax) return null
  const numEntries = view.getUint16(ifd0Start, littleEndian)

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0Start + 2 + i * 12
    if (entryOffset + 12 > clampedMax) break

    const tag = view.getUint16(entryOffset, littleEndian)

    if (tag === 0x0132) {
      // DateTime tag
      const valueOffset = view.getUint32(entryOffset + 8, littleEndian)
      dateTime = readString(view, tiffStart + valueOffset, 19, clampedMax)
    }

    if (tag === 0x8769) {
      // ExifIFD pointer
      exifIfdOffset = view.getUint32(entryOffset + 8, littleEndian)
    }
  }

  // Search Exif sub-IFD for DateTimeOriginal (preferred)
  if (exifIfdOffset !== null) {
    const subIfdStart = tiffStart + exifIfdOffset
    if (subIfdStart + 2 < clampedMax) {
      const subEntries = view.getUint16(subIfdStart, littleEndian)
      for (let i = 0; i < subEntries; i++) {
        const entryOffset = subIfdStart + 2 + i * 12
        if (entryOffset + 12 > clampedMax) break

        const tag = view.getUint16(entryOffset, littleEndian)
        if (tag === 0x9003 || tag === 0x9004) {
          // DateTimeOriginal (0x9003) or DateTimeDigitized (0x9004)
          const valueOffset = view.getUint32(entryOffset + 8, littleEndian)
          const str = readString(view, tiffStart + valueOffset, 19, clampedMax)
          if (str) return str // Prefer this over DateTime
        }
      }
    }
  }

  return dateTime
}

function readString(view, offset, length, max) {
  if (offset + length > max) return null
  let str = ''
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i)
    if (c === 0) break
    str += String.fromCharCode(c)
  }
  return str.length > 0 ? str : null
}

function parseExifDateString(str) {
  // EXIF format: "YYYY:MM:DD HH:MM:SS"
  const match = str.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return null

  const [, year, month, day, hour, min, sec] = match
  const datetime = new Date(+year, +month - 1, +day, +hour, +min, +sec)

  if (isNaN(datetime.getTime())) return null

  return {
    date: `${year}-${month}-${day}`,
    datetime,
    source: 'exif',
  }
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Validates whether a photo's date matches the reported workout date.
 * Returns a warning message if dates don't match, or null if OK.
 *
 * @param {File} file - The photo file
 * @param {string} reportedDate - The date the user claims (YYYY-MM-DD)
 * @returns {Promise<{valid: boolean, message: string, photoDate: string|null}>}
 */
export async function validatePhotoDate(file, reportedDate) {
  const photoInfo = await extractPhotoDate(file)

  if (!photoInfo) {
    return {
      valid: true, // Can't validate — let it through with a note
      message: 'No se pudo leer la fecha de la foto. Asegúrate de que sea del día correcto.',
      photoDate: null,
    }
  }

  const photoDate = photoInfo.date
  if (photoDate === reportedDate) {
    return {
      valid: true,
      message: null,
      photoDate,
    }
  }

  // Check if it's just 1 day off (timezone edge case)
  const reported = new Date(reportedDate + 'T12:00:00')
  const photo = new Date(photoDate + 'T12:00:00')
  const diffDays = Math.abs(Math.round((reported - photo) / (1000 * 60 * 60 * 24)))

  if (diffDays <= 1) {
    return {
      valid: true, // Allow 1-day tolerance
      message: `La foto es del ${photoDate} (${photoInfo.source === 'exif' ? 'dato EXIF' : 'fecha archivo'}). Diferencia de 1 día — podría ser por zona horaria.`,
      photoDate,
    }
  }

  return {
    valid: false,
    message: `⚠️ La foto es del ${photoDate}, pero reportas el ${reportedDate}. La foto debe ser del día de la actividad.`,
    photoDate,
  }
}
