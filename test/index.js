'use strict';
/*global describe, it, before, after, beforeEach, afterEach*/

var fs = require('fs');
var net = require('net');
var assert = require('assert');
var Bufsp = require('../index.js');

var echoServer = net.createServer(function(socket) {
  socket.on('data', function(chunk) {
    socket.write(chunk);
  });
});
echoServer.listen(2999);

describe('Bufsp', function() {
  after(function(callback) {
    setTimeout(function() {
      process.exit(0);
      callback();
    }, 1000);
  });

  it('Bufsp.encode', function(done) {
    assert(Bufsp.encode(null).equals(new Buffer('$-1\r\n')));
    assert(Bufsp.encode(new Error('error')).equals(new Buffer('-Error error\r\n')));
    assert(Bufsp.encode(new TypeError('error')).equals(new Buffer('-TypeError error\r\n')));
    assert(Bufsp.encode('').equals(new Buffer('$0\r\n\r\n')));
    assert(Bufsp.encode('abcdefg').equals(new Buffer('$7\r\nabcdefg\r\n')));
    assert(Bufsp.encode('中文汉字没问题').equals(new Buffer('$21\r\n中文汉字没问题\r\n')));
    assert(Bufsp.encode(new Buffer(10).fill(0)).equals(new Buffer('$10\r\n\0\0\0\0\0\0\0\0\0\0\r\n')));
    assert(Bufsp.encode('QlVGU1A=', 'base64').equals(new Buffer('$5\r\nBUFSP\r\n')));
    assert(Bufsp.encode('4255465350', 'hex').equals(new Buffer('$5\r\nBUFSP\r\n')));

    assert.throws(function() { Bufsp.encode(0); });
    assert.throws(function() { Bufsp.encode(NaN); });
    assert.throws(function() { Bufsp.encode({}); });
    assert.throws(function() { Bufsp.encode([]); });

    done();
  });

  it('Bufsp.decode', function(done) {
    assert(Bufsp.decode(Bufsp.encode(null)) === null);
    assert(Bufsp.decode(Bufsp.encode(null), 'utf8') === null);

    assert(Bufsp.decode(Bufsp.encode('null')).equals(new Buffer('null')));
    assert(Bufsp.decode(Bufsp.encode('null'), 'utf8') === 'null');

    var error = Bufsp.decode(Bufsp.encode(new Error('test')));
    assert(error.name === 'Error');
    assert(error.message === 'test');

    error = Bufsp.decode(Bufsp.encode(new TypeError('test')));
    assert(error.name === 'TypeError');
    assert(error.message === 'test');

    assert(Bufsp.decode(Bufsp.encode(new Buffer(10).fill(9))).equals(new Buffer(10).fill(9)));
    assert.throws(function() { Bufsp.decode(Bufsp.encode(new Error('test')).slice(1)); });
    assert.throws(function() { Bufsp.decode(Bufsp.encode('null').slice(0, -1)); });

    done();
  });

  it('new Bufsp()', function(done) {
    var bufsp = new Bufsp();
    var socket = net.createConnection(2999);
    var tasks = [
      null,
      new Error('test'),
      '12345',
      JSON.stringify([1, 2, 3, 4, 5])
    ];
    var res = [];

    var calledDrain = null;
    socket.pipe(bufsp)
      .on('error', done)
      .on('data', function(message) {
        res.push(message);
      })
      .on('drain', function() {
        calledDrain = true;
      })
      .on('finish', function() {
        assert(calledDrain === true);
        assert(res[0] === tasks[0]);
        assert(res[1] instanceof Error);
        assert(res[2] instanceof Buffer);
        assert(res[2].toString() === tasks[2]);
        assert(res[3].toString() === tasks[3]);
        done();
      });

    tasks.map(function(data) {
      socket.write(bufsp.encode(data));
    });

    socket.end();
  });

  it('new Bufsp({returnString: true})', function(done) {
    var bufsp = new Bufsp({returnString: true});
    var socket = net.createConnection(2999);
    var tasks = [
      null,
      new Error('test'),
      '12345',
      JSON.stringify([1, 2, 3, 4, 5])
    ];
    var res = [];

    var calledDrain = null;
    socket.pipe(bufsp)
      .on('error', done)
      .on('data', function(message) {
        res.push(message);
      })
      .on('drain', function() {
        calledDrain = true;
      })
      .on('finish', function() {
        assert(calledDrain === true);
        assert(res[0] === tasks[0]);
        assert(res[1] instanceof Error);
        assert(res[2] === tasks[2]);
        assert(res[3] === tasks[3]);
        done();
      });

    tasks.map(function(data) {
      socket.write(bufsp.encode(data));
    });

    socket.end();
  });

  it('new Bufsp() with error data', function(done) {
    var bufsp = new Bufsp({returnString: true});
    var socket = net.createConnection(2999);
    var res = [];

    var calledDrain = null;
    socket.pipe(bufsp)
      .on('error', function(err) {
        assert(calledDrain === null);
        assert(res[0] === null);
        assert(res.length === 1);
        done();
      })
      .on('data', function(message) {
        res.push(message);
      })
      .on('drain', function() {
        calledDrain = true;
      });

    socket.write(bufsp.encode(null));
    socket.write(new Buffer('\r\n\r\n'));
    socket.write(bufsp.encode('12345'));
    socket.write(bufsp.encode(new Buffer('$2\r\nabc\r\n')));

    socket.end();
  });

  it('new Bufsp() Pipelining data', function(done) {
    var bufsp = new Bufsp({returnString: true});
    var socket = net.createConnection(2999);
    var tasks = [fs.readFileSync('index.js')];
    var res = [];
    for (var i = 0; i < 100000; i++) tasks.push(i + '');
    var concatBuffer = Buffer.concat(tasks.map(function(data) {
      return bufsp.encode(data);
    }));

    var count = 0;

    socket.on('data', function() {
      count++;
    });

    socket.pipe(bufsp)
      .on('error', done)
      .on('data', function(message) {
        res.push(message);
      })
      .on('finish', function() {
        assert(count > 2);
        res.forEach(function(data, index) {
          assert(tasks[index].toString() === data);
        });
        done();
      });

    socket.end(concatBuffer);
  });
});
