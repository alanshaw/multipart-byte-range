/**
 * @typedef {{
 *   header: Uint8Array
 *   contentPromise: Promise<ReadableStream<Uint8Array>>
 *   footer: Uint8Array
 * }} Part
 */

const LineBreak = '\r\n'
export const ContentType = 'application/octet-stream'

/** @extends {ReadableStream<Uint8Array>} */
export class MultipartByteRange extends ReadableStream {
  #headers
  #length

  /**
   * @param {import('./index.js').Range[]} ranges
   * @param {import('./index.js').ByteGetter} getBytes
   * @param {import('./index.js').Options} [options]
   */
  constructor (ranges, getBytes, options) {
    /** @type {Part[]} */
    const parts = []
    /** @type {Part|undefined} */
    let part
    /** @type {AsyncIterator<Uint8Array>} */
    let contentIterator

    super({
      async pull (controller) {
        if (!part) {
          part = parts.shift()
          if (!part) return controller.close()

          controller.enqueue(part.header)
          contentIterator = (await part.contentPromise)[Symbol.asyncIterator]()
        }

        const { done, value } = await contentIterator.next()
        if (done) {
          controller.enqueue(part.footer)

          part = parts.shift()
          if (!part) return controller.close()

          controller.enqueue(part.header)
          contentIterator = (await part.contentPromise)[Symbol.asyncIterator]()
          return
        }
        controller.enqueue(value)
      }
    }, options?.strategy)

    let contentLength = 0
    const boundary = generateBoundary()

    for (const range of ranges) {
      const absRange = resolveRange(range, options?.totalSize)
      const header = encodePartHeader(boundary, absRange, options)
      const footer = encodePartFooter(boundary, range === ranges.at(-1))
      contentLength += header.length + (absRange[1] - absRange[0] + 1) + footer.length
      parts.push({ header, contentPromise: getBytes(absRange), footer })
    }

    this.#headers = {
      'Content-Length': contentLength.toString(),
      'Content-Type': `multipart/byteranges; boundary=${boundary}`
    }
    this.#length = contentLength
  }

  get length () {
    return this.#length
  }

  get headers () {
    return this.#headers
  }
}

/**
 * @param {string} boundary
 * @param {import('./index.js').Range} range
 * @param {import('./index.js').Options} [options]
 */
const encodePartHeader = (boundary, range, options) => {
  const contentType = options?.contentType ?? ContentType
  const totalSize = options?.totalSize ?? '*'
  const contentRange = `bytes ${range[0]}-${range[1]}/${totalSize}`
  const headers = `Content-Type: ${contentType}${LineBreak}Content-Range: ${contentRange}`
  return new TextEncoder().encode(`--${boundary}${LineBreak}${headers}${LineBreak}${LineBreak}`)
}

/**
 * @param {string} boundary
 * @param {boolean} isLast
 */
const encodePartFooter = (boundary, isLast) =>
  new TextEncoder().encode(isLast ? `${LineBreak}--${boundary}--${LineBreak}` : LineBreak)

const generateBoundary = () => {
  let boundary = '-----------------------'
  for (let i = 0; i < 24; i++) {
    boundary += Math.floor(Math.random() * 10).toString(16)
  }
  return boundary
}

/**
 * @param {import('./index.js').Range} range
 * @param {number} [totalSize]
 * @returns {import('./index.js').AbsRange}
 */
const resolveRange = (range, totalSize) => {
  let last = range[1]
  if (last == null) {
    if (totalSize == null) {
      throw new Error('suffix range requested but total size unknown')
    }
    last = totalSize - 1
  }
  const first = range[1] == null && range[0] < 0 ? (last + 1 + range[0]) : range[0]
  return [first, last]
}
