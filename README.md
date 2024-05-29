# multipart-byte-range

[![Build](https://github.com/alanshaw/carstream/actions/workflows/build.yml/badge.svg)](https://github.com/alanshaw/multipart-byte-range/actions/workflows/build.yml)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Encode and decode `multipart/byteranges` stream.

## Install

```sh
npm install multipart-byte-range
```

## Usage

### Encode

```js
import { MultipartByteRangeEncoder } from 'multipart-byte-range'

const data = new Blob(['data'.repeat(500)])

// Range: bytes=3-6, 12-100, 110-
const ranges = [[3, 6], [12, 100], [110]]

// fetch the bytes for the passed range
const getRange = async range => data.slice(range[0], range[1] + 1).stream()

// optionally specify the total size or the content type
const options = { totalSize: data.length, contentType: 'application/octet-stream' }

new MultipartByteRangeEncoder(ranges, getRange, options).pipeTo(new WritableStream())
```

### Decode

```js
import { MultipartByteRangeDecoder, getBoundary, decodePartHeader } from 'multipart-byte-range'

const res = await fetch(url, { headers: { Range: `bytes=3-6,18-29` } })
const boundary = getBoundary(res.headers)

await res.body
  .pipeThrough(new MultipartByteRangeDecoder(boundary))
  .pipeTo(new WritableStream({
    write (part) {
      const headers = decodePartHeader(part.header)
      const bytes = part.content
    }
  }))
```

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/alanshaw/multipart-byte-range/issues)!

## License

Dual-licensed under [MIT / Apache 2.0](https://github.com/alanshaw/multipart-byte-range/blob/main/LICENSE.md)
