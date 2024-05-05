const LineBreak = '\r\n'
export const ContentType = 'application/octet-stream'

/** @extends {ReadableStream<Uint8Array>} */
export class MultipartByteRange extends ReadableStream {
  #headers

  /**
   * @param {import('./index.js').Range[]} ranges
   * @param {import('./index.js').RangeGetter} getRange
   * @param {import('./index.js').Options} [options]
   */
  constructor (ranges, getRange, options) {
    /** @type {Uint8Array[]} */
    const headers = []
    /** @type {Uint8Array[]} */
    const footers = []

    /** @type {import('./index.js').AbsRange[]} */
    const absRanges = ranges.map(r => {
      let last = r[1]
      if (last == null) {
        if (options?.totalSize == null) {
          throw new Error('suffix range requested but total size unknown')
        }
        last = options.totalSize - 1
      }
      const first = r[1] == null && r[0] < 0 ? last + r[0] : r[0]
      return [first, last]
    })

    super({
      async pull (controller) {
        const range = absRanges.shift()
        if (!range) return controller.close()
        controller.enqueue(headers.shift())
        controller.enqueue(await getRange(range))
        controller.enqueue(footers.shift())
      }
    }, options?.strategy)

    let contentLength = 0
    const boundary = generateBoundary()
    for (const range of absRanges) {
      const header = encodePartHeader(boundary, range, options)
      headers.push(header)

      const footer = encodePartFooter(boundary, range === absRanges.at(-1))
      footers.push(footer)

      contentLength += header.length + (range[1] - range[0] + 1) + footer.length
    }

    this.#headers = {
      'Content-Length': contentLength.toString(),
      'Content-Type': `multipart/byteranges; boundary=${boundary}`
    }
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
