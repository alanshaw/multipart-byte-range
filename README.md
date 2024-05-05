# multipart-byte-range

[![Build](https://github.com/alanshaw/carstream/actions/workflows/build.yml/badge.svg)](https://github.com/alanshaw/multipart-byte-range/actions/workflows/build.yml)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Create `multipart/byteranges` stream.

## Install

```sh
npm install multipart-byte-range
```

## Usage

```js
import { MultipartByteRange } from 'multipart-byte-range'

const data = new Uint8Array(138)

// Range: bytes=3-6, 12-100, 110-
const ranges = [[3, 6], [12, 100], [110]]

// fetch the bytes for the passed range
const getRange = async range => data.slice(range[0], range[1] + 1)

// optionally specify the total size or the content type
const options = { totalSize: data.length, contentType: 'application/octet-stream' }

new MultipartByteRange(ranges, getRange, options).pipeTo(new WritableStream())
```

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/alanshaw/multipart-byte-range/issues)!

## License

Dual-licensed under [MIT / Apache 2.0](https://github.com/alanshaw/multipart-byte-range/blob/main/LICENSE.md)
