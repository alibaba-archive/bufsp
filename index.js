'use strict';
/*
 * BUFSP
 * https://github.com/teambition/bufsp
 *
 * Licensed under the MIT license.
 */

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var CRLF = '\r\n';

module.exports = Bufsp;
Bufsp.encode = encode;
Bufsp.decode = decode;

function Bufsp(options) {
  if (!(this instanceof Bufsp)) return new Bufsp(options);
  options = options || {};

  this._encoding = options.encoding || 'utf8';
  this._stringEncoding = !!options.returnString && this._encoding;

  // legacy from old stream.
  this.writable = true;

  clearState(this);
  EventEmitter.call(this);
}
util.inherits(Bufsp, EventEmitter);

Bufsp.prototype.encode = function(val, encoding) {
  return encode(val, encoding || this._encoding);
};

Bufsp.prototype.decode = function(val, encoding) {
  return decode(val, encoding || this._stringEncoding);
};

Bufsp.prototype.write = function(chunk) {
  if (!Buffer.isBuffer(chunk)) {
    this.emit('error', new Error('Invalid buffer chunk'));
    return true;
  }

  if (!this._buffer) this._buffer = chunk;
  else {
    var ret = this._buffer.length - this._index;
    var concatBuffer = new Buffer(chunk.length + ret);

    this._buffer.copy(concatBuffer, 0, this._index);
    chunk.copy(concatBuffer, ret);
    this._buffer = concatBuffer;
    this._index = 0;
  }

  while (this._index < this._buffer.length) {
    var result = parseBuffer(this._buffer, this._index, this._stringEncoding);
    if (result == null) {
      this.emit('drain');
      return true;
    }
    if (result instanceof Error) {
      clearState(this);
      this.emit('error', result);
      return false;
    }
    this._index = result.index;
    this.emit('data', result.content);
  }

  clearState(this).emit('drain');
  return true;
};

Bufsp.prototype.end = function(chunk) {
  if (chunk) this.write(chunk);
  this.emit('finish');
};

function clearState(ctx) {
  ctx._index = 0;
  ctx._buffer = null;
  return ctx;
}

function encode(val, encoding) {
  if (val == null) return new Buffer('$-1\r\n');

  if (util.isError(val)) {
    val = '-' + val.name + ' ' + val.message + CRLF;
    return new Buffer(val);
  }

  if (!Buffer.isBuffer(val)) {
    if (typeof val !== 'string') throw new Error('Invalid value to encode');
    val = new Buffer(val, encoding);
  }
  var str = '$' + val.length + CRLF;
  var buffer = new Buffer(str.length + val.length + 2);
  buffer.write(str);
  val.copy(buffer, str.length);
  buffer.write(CRLF, str.length + val.length);
  return buffer;
}

function decode(buffer, encoding) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Invalid buffer chunk');
  var result = parseBuffer(buffer, 0, encoding);
  if (!result || result.index < buffer.length) throw new Error('Decode failed');
  if (result instanceof Error) throw result;
  return result.content;
}

function readBuffer(buffer, index) {
  var start = index;
  while (index < buffer.length && !isCRLF(buffer, index)) index++;

  return index >= buffer.length ? null : {
    content: buffer.utf8Slice(start, index),
    index: index + 2
  };
}

function parseBuffer(buffer, index, stringEncoding) {
  var len = NaN;
  var result = readBuffer(buffer, index + 1);
  if (result == null) return result;

  switch (buffer[index]) {
    case 45: // '-'
      var fragment = result.content.match(/^(\S+) ([\s\S]+)$/);
      if (!fragment) return new Error('Parse "-" failed');
      result.content = new Error(fragment[2]);
      result.content.name = fragment[1];
      return result;

    case 36: // '$'
      len = +result.content;
      if (!result.content.length || len !== len) return new Error('Parse "$" failed, invalid length');
      if (len === -1) result.content = null;
      else if (buffer.length < result.index + len + 2) return null;
      else if (!isCRLF(buffer, result.index + len)) return new Error('Parse "$" failed, invalid CRLF');
      else {
        result.content = buffer.slice(result.index, result.index + len);
        if (stringEncoding) result.content = result.content.toString(stringEncoding);
        result.index = result.index + len + 2;
      }
      return result;
  }
  return new Error('Invalid Buffer: parse failed');
}

function isCRLF(buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10;
}
