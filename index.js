'use strict';
/*
 * RESP.js
 * https://github.com/zensh/resp.js
 *
 * Copyright (c) 2014 Yan Qing
 * Licensed under the MIT license.
 */

var util = require('util');
var Transform = require('stream').Transform;
var CRLF = '\r\n';

exports.Bufsp = Bufsp;
exports.encode = encode;
exports.decode = decode;

function Bufsp(options) {
  if (!(this instanceof Bufsp)) return new Bufsp(options);
  options = options || {};
  options.encoding = options.encoding || 'utf8';

  this._encoding = options.encoding;
  this._stringEncoding = !!options.returnString && options.encoding;

  clearState(this);
  Transform.call(this, options);
}
util.inherits(Bufsp, Transform);

Bufsp.prototype.encode = function(val, encoding) {
  return encode(val, encoding || this._encoding);
};

Bufsp.prototype.decode = function(val, encoding) {
  return decode(val, encoding || this._encoding);
};

Bufsp.prototype._transform = function(chunk, encoding, done) {
  if (!Buffer.isBuffer(chunk)) return done(new BufspError('Invalid buffer chunk'));

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
      return done();
    }
    if (result instanceof Error) {
      clearState(this);
      return done(result);
    }
    this._index = result.index;
    this.push(result.content);
  }

  clearState(this).emit('drain');
  return done();
};

function clearState(ctx) {
  ctx._index = 0;
  ctx._buffer = null;
  return ctx;
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
      if (!result.content.length) return new BufspError('Parse "-" failed');
      var type = result.content.replace(/\s[\s\S]*$/, '');
      result.content = new Error(result.content);
      result.content.type = type;
      return result;

    case 36: // '$'
      len = +result.content;
      if (!result.content.length || len !== len) return new BufspError('Parse "$" failed, invalid length');
      if (len === -1) result.content = null;
      else if (buffer.length < result.index + len + 2) return null;
      else if (!isCRLF(buffer, result.index + len)) return new BufspError('Parse "$" failed, invalid CRLF');
      else {
        result.content = buffer.slice(result.index, result.index + len);
        if (stringEncoding) result.content = result.content.toString(stringEncoding);
        result.index = result.index + len + 2;
      }
      return result;
  }
  return new BufspError('Invalid Chunk: parse failed');
}

function encode(val, encoding) {
  if (val == null) return new Buffer('$-1\r\n');

  if (util.isError(val)) {
    val = '-' + (val.type || val.name) + ' ' + val.message + CRLF;
    return new Buffer(val);
  }

  if (!Buffer.isBuffer(val)) val = new Buffer(val, encoding);
  var str = '$' + val.length + CRLF;
  var buffer = new Buffer(str.length + val.length + 2);
  buffer.write(str);
  val.copy(buffer, str.length);
  buffer.write(CRLF, str.length + val.length);
  return buffer;
}

function decode(buffer, encoding) {
  if (!Buffer.isBuffer(buffer)) throw new BufspError('Invalid buffer chunk');
  var result = parseBuffer(buffer, 0, encoding);
  if (!result || result.index < buffer.length) throw new BufspError('Decode failed');
  if (result instanceof Error) throw result;
  return result.content;
}

function isCRLF(buffer, index) {
  return buffer[index] === 13 && buffer[index + 1] === 10;
}

function BufspError(message) {
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
}
util.inherits(BufspError, Error);
BufspError.prototype.name = 'BufspError';
