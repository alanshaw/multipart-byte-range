import { SBMH } from 'streamsearch-web'
import { Uint8ArrayList } from 'uint8arraylist'

/** @typedef {{ header: Uint8Array, content: Uint8Array }} Part */

const LineBreak = '\r\n'
const LineBreakBytes = new TextEncoder().encode(LineBreak)
const DoubleLineBreakBytes = new TextEncoder().encode(LineBreak + LineBreak)
const boundaryRegex = /boundary=([\w-]+)/i

/** @param {Headers} headers */
export const getBoundary = (headers) => {
  const contentType = headers.get('content-type') ?? ''
  const match = boundaryRegex.exec(contentType)
  return match && match[1]
}

/** @param {Uint8Array} bytes */
export const decodePartHeader = bytes => {
  const str = new TextDecoder().decode(bytes)
  return new Headers(str.split(LineBreak).map(s => {
    const index = s.indexOf(':')
    return [s.slice(0, index), s.slice(index + 1).trim()]
  }))
}

/** @extends {TransformStream<Uint8Array, Part>} */
export class MultipartByteRangeDecoder extends TransformStream {
  /**
   * @param {string} boundary
   * @param {QueuingStrategy<Uint8Array>} [writableStrategy]
   * @param {QueuingStrategy<Part>} [readableStrategy]
   */
  constructor (boundary, writableStrategy, readableStrategy) {
    const boundarySearch = new SBMH(new TextEncoder().encode(`--${boundary}`))
    const part = new Uint8ArrayList()
    let first = true
    super({
      transform (chunk, controller) {
        for (const match of boundarySearch.push(chunk)) {
          if (!first && match.hasNonMatchData) {
            const nonMatchData = match.isSafe
              ? match.data.subarray(match.begin, match.end)
              : match.data.slice(match.begin, match.end)
            part.append(nonMatchData)
          }

          if (match.isMatch) {
            if (first) {
              first = false
              continue
            }

            const index = part.indexOf(DoubleLineBreakBytes)
            if (index === -1) throw new Error('headers not found')

            controller.enqueue({
              header: part.subarray(LineBreakBytes.length, index),
              content: part.subarray(index + DoubleLineBreakBytes.length, part.length - LineBreakBytes.length)
            })
            part.consume(part.byteLength)
          }
        }
      }
    }, writableStrategy, readableStrategy)
  }
}
