BUFSP
====
Buffer Frame Serialization Protocol (BUFSP), parse pipelining chunks.

[![NPM version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

BUFSP is a low level protocol designed specifically for socket commutation with buffer frames.

As we know, **chunks** output from net socket mostly are not represent integrated messages. Sometimes a **chunk** include onemore integrated messages, or a number of chunks represent a integrated message. How can we get message one by one from these chunks? **BUFSP** is designed.

It is a subset of `Redis` [RESP](http://redis.io/topics/protocol).

There are only two type:

- **Errors**, the first byte of the reply is "-"
- **Bulk Strings**, the first byte of the reply is "$"

### BUFSP Errors

BUFSP error is use to response a error from one side to another. The basic format is:

```
"-Error message\r\n"
```

Become to buffer:
```
<Buffer 2d 45 72 72 6f 72 20 6d 65 73 73 61 67 65 0d 0a>
```

It will be decoded to `new Error(message)`.

### BUFSP Bulk Strings

Bulk string is used in order to represent single binary safe string, binary buffer, or `null`.

Bulk Strings are encoded in the following way:

- A `"$"` byte followed by the number of bytes composing the string (a prefixed length), terminated by CRLF.
- The actual string or binary data.
- A final CRLF.

So the string "foobar" is encoded as follows:

```
"$6\r\nfoobar\r\n"
```

the string "中文" is encoded as follows:

```
"$6\r\n中文\r\n"
```

the binary buffer `new Buffer(10).fill(0)` is encoded as follows:

```
"$10\r\n\0\0\0\0\0\0\0\0\0\0\r\n"
```

When an empty string is just:

```
"$0\r\n\r\n"
```

RESP Bulk Strings can also be used in order to signal non-existence of a value using a special format that is used to represent a `null` value. In this special format the length is -1, and there is no data, so a `null` is represented as:

```
"$-1\r\n"
```

This is called a **Null Bulk String**. It can be use as heartbeat packet.

## Install

Install with [npm](https://npmjs.org/package/bufsp)

```
npm install bufsp
```


## Usage


## API

```js
var Bufsp = require('bufsp');
```

### Class Bufsp

#### new Bufsp([options])

Bufsp is a EventEmitter similar to `Writable` stream. It accept `BUFSP` chunks, parse them, produce integrated buffer frames | strings | null | error. `Readable` stream can be piped to `bufsp`.

- `options` {Object}
  - `encoding` {String} use to encode or decode between buffer and string, default to `'utf8'`
  - `returnString` {Boolean} produce string with `encoding` option, default to `false`

```js
var socket = net.connect(options);
var bufsp = new Bufsp({returnString: true});

bufsp.on('data', function(message) {
  // received data and decode to message
  console.log(JSON.stringify(message))
});

socket.pipe(bufsp);
// or
// socket.on('data', function (chunk) {
//   bufsp.write(chunk);
// });


// server side send a message in BUFSP buffer to the client
server_socket.write(bufsp.encode(JSON.stringify({_id: 'xxx', name: 'test'})));
```

#### Class Method: Bufsp.encode(value[, encoding])

Encode `value` to `BUFSP` buffer.

- `value` {Buffer|String|null|Error} data to encode
- `encoding` {String} String Encoding of String chunks, accept all `Buffer` encodings, default to `undefined`

Return buffer.

```js
var nullBuf = Bufsp.encode(null);
// <Buffer 24 2d 31 0d 0a>

var errorBuf = Bufsp.encode(new Error('error!'));
// <Buffer 2d 45 72 72 6f 72 20 65 72 72 6f 72 21 0d 0a>

var msgBuf = Bufsp.encode(JSON.stringify({_id: 0, name: 'bufsp'}));
// <Buffer 24 32 34 0d 0a 7b 22 5f 69 64 22 3a 30 2c 22 6e 61 6d 65 22 3a 22 62 75 66 73 70 22 7d 0d 0a>

var binBuf = Bufsp.encode(new Buffer([0xff, 0xff, 0xff]));
// <Buffer 24 33 0d 0a ff ff ff 0d 0a>
```

#### Class Method: Bufsp.decode(buffer[, encoding])

Decode `BUFSP` buffer to integrated buffer frame or string.

- `buffer` {Buffer|String|null|Error} data to decode
- `encoding` {String} String Encoding of String chunks, accept all `Buffer` encodings, default to `undefined`

Return {Buffer|null|Error} data, if encoding is provided, it will try to return string. if buffer can't be decode, it will throw error.

```js
Bufsp.decode(Bufsp.encode(null));
// null

Bufsp.encode(Bufsp.encode(new Error('error!')));
// { [Error: error!] }
```

#### bufsp.write(chunk)

Feed `BUFSP` chunk and parse it. bufsp will emit `data` event while a integrated data decoded.

#### bufsp.end([chunk])

Call this method when no more chunk will be written to bufsp, then `finish` event emit.

#### bufsp.encode(value[, encoding])

The same as `Bufsp.encode`. It will use constructor's `options.encoding` if omitted.

#### bufsp.decode(buffer[, encoding])

The same as `Bufsp.decode`. It will use constructor's `options.returnString && options.encoding` if omitted.

#### Event: 'error'

- `error` {Error}

Emitted when an error occurs.

#### Event: 'data'

- `data` {Buffer|String|null|Error}

Emitted when integrated buffer frame | string | null | error produced. Notice that the data may be `null` or `Error` object, it is not general stream chunk.

#### Event: 'drain'

Emitted when chunk have been parsed or need more chunks for parsing.

#### Event: 'finish'

The `finish` event is fired after `.end()` is called and all chunks have been processed.

## License

MIT © [teambition](https://github.com/teambition)

[npm-url]: https://npmjs.org/package/bufsp
[npm-image]: http://img.shields.io/npm/v/bufsp.svg

[travis-url]: https://travis-ci.org/teambition/bufsp
[travis-image]: http://img.shields.io/travis/teambition/bufsp.svg
