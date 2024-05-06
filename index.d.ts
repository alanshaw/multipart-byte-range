/**
 * An absolute byte range to extract - always an array of two values
 * corresponding to the first and last bytes (both inclusive). e.g.
 * 
 * ```
 * [100, 200]
 * ```
 */
export type AbsRange = [first: number, last: number]

/**
 * Byte range to extract - an array of one or two values corresponding to the
 * first and last bytes (both inclusive). e.g.
 * 
 * ```
 * [100, 200]
 * ```
 * 
 * Omitting the second value requests all remaining bytes of the resource. e.g.
 * 
 * ```
 * [900]
 * ```
 * 
 * Alternatively, if it's unknown how large a resource is, the last `n` bytes
 * can be requested by specifying a negative value:
 * 
 * ```
 * [-100]
 * ```
 */
export type Range = AbsRange | [first: number]

export type ByteGetter = (range: AbsRange) => Promise<ReadableStream<Uint8Array>>

export interface Options {
  /** Mime type of each part. */
  contentType?: string
  /** Total size of the object in bytes. */
  totalSize?: number
  /** Stream queuing strategy. */
  strategy?: QueuingStrategy<Uint8Array>
}

export class MultipartByteRange extends ReadableStream {
  constructor (ranges: Range[], getBytes: ByteGetter, options?: Options)
  /** HTTP headers to send. */
  readonly headers: Record<string, string>
  /** The Content-Length of the stream. */
  readonly length: number
}

export const ContentType = 'application/octet-stream'
