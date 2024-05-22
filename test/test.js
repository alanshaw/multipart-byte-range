import http from 'node:http'
import { Writable } from 'node:stream'
import * as RangeParser from '@httpland/range-parser'
import { MultipartByteRangeEncoder, ContentType } from '../src/encoder.js'
import { MultipartByteRangeDecoder, getBoundary, decodePartHeader } from '../src/decoder.js'

/** @param {import('../src/index.js').Range[]} ranges */
const encodeRangeHeader = ranges =>
  `bytes=${ranges.map(r => `${r[0]}${r[0] < 0 ? '' : '-'}${r[1] == null ? '' : r[1]}`).join(', ')}`

/**
 * @param {string} [str]
 * @returns {import('../src/index.js').Range[]}
 */
const decodeRangeHeader = (str) => {
  if (!str) throw new Error('missing Range header value')
  /** @type {import('../src/index.js').Range[]} */
  const ranges = []
  for (const r of RangeParser.parseRange(str).rangeSet) {
    if (typeof r === 'string') {
      // "other" - ignore
    } else if ('firstPos' in r) {
      ranges.push(r.lastPos != null ? [r.firstPos, r.lastPos] : [r.firstPos])
    } else {
      ranges.push([-r.suffixLength])
    }
  }
  return ranges
}

/**
 * @param {Uint8Array} data
 * @param {{ unknownSize: boolean }} [options]
 */
const createServer = async (data, options) => {
  const server = http.createServer(async (req, res) => {
    console.log(`Request:\n  Range: ${req.headers.range}`)
    const ranges = decodeRangeHeader(req.headers.range)
    const source = new MultipartByteRangeEncoder(
      ranges,
      async range => new Blob([data.slice(range[0], range[1] + 1)]).stream(),
      { totalSize: options?.unknownSize ? undefined : data.length }
    )
    console.log('Response:')
    for (const [k, v] of Object.entries(source.headers)) {
      console.log(`  ${k}: ${v}`)
      res.setHeader(k, v)
    }

    res.statusCode = 206
    await source
      .pipeThrough(new TransformStream({
        transform (chunk, controller) {
          process.stdout.write(chunk)
          controller.enqueue(chunk)
        }
      }))
      .pipeTo(Writable.toWeb(res))
  })
  const url = await new Promise(resolve => {
    // @ts-expect-error
    server.listen(() => resolve(`http://localhost:${server.address().port}`))
  })
  console.log(url)
  return { server, url }
}

export const test = {
  'should encode valid response': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('../src/index.js').AbsoluteRange[]} */
    const ranges = [[3, 6], [100, 105]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const boundary = getBoundary(res.headers)
      assert.ok(boundary)

      let partsCount = 0
      let bytesCount = 0
      await res.body
        .pipeThrough(new TransformStream({
          transform (chunk, controller) {
            bytesCount += chunk.length
            controller.enqueue(chunk)
          }
        }))
        .pipeThrough(new MultipartByteRangeDecoder(boundary))
        .pipeTo(new WritableStream({
          write (part) {
            const range = ranges[partsCount]
            const headers = decodePartHeader(part.header)
            assert.equal(headers.get('content-type'), ContentType)
            assert.equal(headers.get('content-range'), `bytes ${range[0]}-${range[1]}/${data.length}`)
            assert.deepEqual(
              part.content,
              data.subarray(range[0], range[1] + 1)
            )
            partsCount++
          }
        }))
      assert.equal(partsCount, ranges.length)

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), bytesCount)
    } finally {
      server.close()
    }
  },

  'should encode valid response with unknown size': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('../src/index.js').AbsoluteRange[]} */
    const ranges = [[3, 6], [100, 105]]
    const { server, url } = await createServer(data, { unknownSize: true })

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const boundary = getBoundary(res.headers)
      assert.ok(boundary)

      let partsCount = 0
      let bytesCount = 0
      await res.body
        .pipeThrough(new TransformStream({
          transform (chunk, controller) {
            bytesCount += chunk.length
            controller.enqueue(chunk)
          }
        }))
        .pipeThrough(new MultipartByteRangeDecoder(boundary))
        .pipeTo(new WritableStream({
          write (part) {
            const range = ranges[partsCount]
            const headers = decodePartHeader(part.header)
            assert.equal(headers.get('content-type'), ContentType)
            assert.equal(headers.get('content-range'), `bytes ${range[0]}-${range[1]}/*`)
            assert.deepEqual(
              part.content,
              data.subarray(range[0], range[1] + 1)
            )
            partsCount++
          }
        }))
      assert.equal(partsCount, ranges.length)

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), bytesCount)
    } finally {
      server.close()
    }
  },

  'should throw for suffix range of unknown size data': async (/** @type {import('entail').assert} */ assert) => {
    assert.throws(() => new MultipartByteRangeEncoder(
      [[1, 2], [3]],
      async _ => new ReadableStream()
    ), /suffix range requested but total size unknown/)
  },

  'should allow positive suffix range': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('../src/index.js').Range[]} */
    const ranges = [[3, 6], [100]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const boundary = getBoundary(res.headers)
      assert.ok(boundary)

      let partsCount = 0
      let bytesCount = 0
      await res.body
        .pipeThrough(new TransformStream({
          transform (chunk, controller) {
            bytesCount += chunk.length
            controller.enqueue(chunk)
          }
        }))
        .pipeThrough(new MultipartByteRangeDecoder(boundary))
        .pipeTo(new WritableStream({
          write (part) {
            const range = ranges[partsCount]
            const headers = decodePartHeader(part.header)
            assert.equal(headers.get('content-type'), ContentType)
            assert.equal(headers.get('content-range'), `bytes ${range[0]}-${range[1] ?? data.length - 1}/${data.length}`)
            assert.deepEqual(
              part.content,
              data.subarray(range[0], range[1] ? range[1] + 1 : data.length)
            )
            partsCount++
          }
        }))
      assert.equal(partsCount, ranges.length)

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), bytesCount)
    } finally {
      server.close()
    }
  },

  'should allow negative suffix range': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('../src/index.js').Range[]} */
    const ranges = [[3, 6], [-30]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const boundary = getBoundary(res.headers)
      assert.ok(boundary)

      let partsCount = 0
      let bytesCount = 0
      await res.body
        .pipeThrough(new TransformStream({
          transform (chunk, controller) {
            bytesCount += chunk.length
            controller.enqueue(chunk)
          }
        }))
        .pipeThrough(new MultipartByteRangeDecoder(boundary))
        .pipeTo(new WritableStream({
          write (part) {
            const range = ranges[partsCount]
            const headers = decodePartHeader(part.header)
            assert.equal(headers.get('content-type'), ContentType)
            assert.equal(
              headers.get('content-range'),
              `bytes ${range[0] < 0 ? data.length + range[0] : range[0]}-${range[1] ?? data.length - 1}/${data.length}`
            )
            assert.deepEqual(
              part.content,
              data.subarray(
                range[0] < 0 ? data.length + range[0] : range[0],
                range[1] ? range[1] + 1 : data.length
              )
            )
            partsCount++
          }
        }))
      assert.equal(partsCount, ranges.length)

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), bytesCount)
    } finally {
      server.close()
    }
  }
}
