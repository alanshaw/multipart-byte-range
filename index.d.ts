export type AbsRange = [first: number, last: number]
export type Range = AbsRange | [first: number]

export type RangeGetter = (range: AbsRange) => Promise<Uint8Array>

export interface Options {
  /** Mime type of each part. */
  contentType?: string
  /** Total size of the object in bytes. */
  totalSize?: number
  /** Stream queuing strategy. */
  strategy?: QueuingStrategy<Uint8Array>
}

export class MultipartByteRange extends ReadableStream {
  constructor (ranges: Range[], getRange: RangeGetter, options?: Options)
  readonly headers: Record<string, string>
}

export const ContentType = 'application/octet-stream'
