/**
 * An absolute byte range to extract - always an array of two values
 * corresponding to the first and last bytes (both inclusive). e.g.
 * 
 * ```
 * [100, 200]
 * ```
 */
export type AbsoluteRange = [first: number, last: number]

/**
 * A suffix byte range - always an array of one value corresponding to the
 * first byte to start extraction from (inclusive). e.g.
 * 
 * ```
 * [900]
 * ```
 * 
 * If it is unknown how large a resource is, the last `n` bytes
 * can be requested by specifying a negative value:
 * 
 * ```
 * [-100]
 * ```
 */
export type SuffixRange = [first: number]

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
export type Range = AbsoluteRange | SuffixRange

export type ByteGetter = (range: AbsoluteRange) => Promise<ReadableStream<Uint8Array>>

export interface EncoderOptions {
  /** Mime type of each part. */
  contentType?: string
  /** Total size of the object in bytes. */
  totalSize?: number
  /** Stream queuing strategy. */
  strategy?: QueuingStrategy<Uint8Array>
}
