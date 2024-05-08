import http from 'node:http'
import { Writable } from 'node:stream'
import { Buffer } from 'node:buffer'
import * as ByteRanges from 'byteranges'
import * as RangeParser from '@httpland/range-parser'
import { MultipartByteRange, ContentType } from './index.js'

/** @param {import('./index.js').Range[]} ranges */
const encodeRangeHeader = ranges =>
  `bytes=${ranges.map(r => `${r[0]}${r[0] < 0 ? '' : '-'}${r[1] == null ? '' : r[1]}`).join(', ')}`

/**
 * @param {string} [str]
 * @returns {import('./index.js').Range[]}
 */
const decodeRangeHeader = (str) => {
  if (!str) throw new Error('missing Range header value')
  /** @type {import('./index.js').Range[]} */
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
    const source = new MultipartByteRange(
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
    /** @type {import('./index.js').Range[]} */
    const ranges = [[3, 6], [100, 105]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const contentType = res.headers.get('Content-Type')
      assert.ok(contentType)

      const boundary = contentType.replace('multipart/byteranges; boundary=', '')
      const out = Buffer.from(await res.arrayBuffer())
      const parts = ByteRanges.parse(out, boundary)

      assert.equal(parts.length, ranges.length)
      for (const p of parts) {
        assert.equal(p.type, ContentType)
        assert.deepEqual(
          [...p.octets],
          [...data.subarray(p.range.range.start, p.range.range.end + 1)]
        )
        assert.equal(p.range.length, data.length)
      }

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), out.length)
    } finally {
      server.close()
    }
  },

  'should encode valid response with unknown size': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('./index.js').Range[]} */
    const ranges = [[3, 6], [100, 105]]
    const { server, url } = await createServer(data, { unknownSize: true })

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const contentType = res.headers.get('Content-Type')
      assert.ok(contentType)

      const boundary = contentType.replace('multipart/byteranges; boundary=', '')
      const out = Buffer.from(await res.arrayBuffer())
      const parts = ByteRanges.parse(out, boundary)

      assert.equal(parts.length, ranges.length)
      for (const p of parts) {
        assert.equal(p.type, ContentType)
        assert.deepEqual(
          [...p.octets],
          [...data.subarray(p.range.range.start, p.range.range.end + 1)]
        )
        assert.equal(p.range.length, '*')
      }

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), out.length)
    } finally {
      server.close()
    }
  },

  'should throw for suffix range of unknown size data': async (/** @type {import('entail').assert} */ assert) => {
    assert.throws(() => new MultipartByteRange(
      [[1, 2], [3]],
      async _ => new ReadableStream()
    ), /suffix range requested but total size unknown/)
  },

  'should allow positive suffix range': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('./index.js').Range[]} */
    const ranges = [[3, 6], [100]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const contentType = res.headers.get('Content-Type')
      assert.ok(contentType)

      const boundary = contentType.replace('multipart/byteranges; boundary=', '')
      const out = Buffer.from(await res.arrayBuffer())
      const parts = ByteRanges.parse(out, boundary)

      assert.equal(parts.length, ranges.length)
      for (const p of parts) {
        assert.equal(p.type, ContentType)
        assert.deepEqual(
          [...p.octets],
          [...data.subarray(p.range.range.start, p.range.range.end + 1)]
        )
        assert.equal(p.range.length, data.length)
      }

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), out.length)
    } finally {
      server.close()
    }
  },

  'should allow negative suffix range': async (/** @type {import('entail').assert} */ assert) => {
    const data = crypto.getRandomValues(new Uint8Array(138))
    /** @type {import('./index.js').Range[]} */
    const ranges = [[3, 6], [-30]]
    const { server, url } = await createServer(data)

    let res
    try {
      res = await fetch(url, { headers: { Range: encodeRangeHeader(ranges) } })
      assert.ok(res.ok)
      assert.ok(res.body)
      assert.equal(res.status, 206)

      const contentType = res.headers.get('Content-Type')
      assert.ok(contentType)

      const boundary = contentType.replace('multipart/byteranges; boundary=', '')
      const out = Buffer.from(await res.arrayBuffer())
      const parts = ByteRanges.parse(out, boundary)

      assert.equal(parts.length, ranges.length)
      for (const p of parts) {
        assert.equal(p.type, ContentType)
        assert.deepEqual(
          [...p.octets],
          [...data.subarray(p.range.range.start, p.range.range.end + 1)]
        )
        assert.equal(p.range.length, data.length)
      }

      const contentLength = res.headers.get('Content-Length')
      assert.ok(contentLength)
      assert.equal(parseInt(contentLength), out.length)
    } finally {
      server.close()
    }
  }
}
