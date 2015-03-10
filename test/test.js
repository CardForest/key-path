/*
 * This code was adapted from https://github.com/Polymer/observe-js/tree/3cf0621767815310f65015b6f6095dc6827e3ce4
 *
 * Including notices as required by the License:
 *
 *   Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions are
 *   met:
 *
 *      * Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 *      * Redistributions in binary form must reproduce the above
 *   copyright notice, this list of conditions and the following disclaimer
 *   in the documentation and/or other materials provided with the
 *   distribution.
 *      * Neither the name of Google Inc. nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 *   A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 *   OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 *   SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 *   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 *   DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 *   THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 *   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var assert = require('chai').assert;
var KeyPath = require('../');
function assertPath(pathString, expectKeys, expectSerialized) {
  var path = KeyPath.get(pathString);
  if (!expectKeys) {
    assert.isFalse(path.valid);
    return;
  }

  assert.deepEqual(Array.prototype.slice.apply(path), expectKeys);
  assert.strictEqual(path.toString(), expectSerialized);
}

function assertInvalidPath(pathString) {
  assertPath(pathString);
}

describe('key-path node module', function () {
  it('constructor throws', function() {
    assert.throws(function() {
      new KeyPath('foo');
    });
  });

  it('path validity', function() {
    // invalid path get value is always undefined
    var p = KeyPath.get('a b');
    assert.isFalse(p.valid);
    assert.isUndefined(p.getValueFrom({ a: { b: 2 }}));

    assertPath('', [], '');
    assertPath(' ', [], '');
    assertPath(null, [], '');
    assertPath(undefined, [], '');
    assertPath('a', ['a'], 'a');
    assertPath('a.b', ['a', 'b'], 'a.b');
    assertPath('a. b', ['a', 'b'], 'a.b');
    assertPath('a .b', ['a', 'b'], 'a.b');
    assertPath('a . b', ['a', 'b'], 'a.b');
    assertPath(' a . b ', ['a', 'b'], 'a.b');
    assertPath('a[0]', ['a', '0'], 'a[0]');
    assertPath('a [0]', ['a', '0'], 'a[0]');
    assertPath('a[0][1]', ['a', '0', '1'], 'a[0][1]');
    assertPath('a [ 0 ] [ 1 ] ', ['a', '0', '1'], 'a[0][1]');
    assertPath('[1234567890] ', ['1234567890'], '[1234567890]');
    assertPath(' [1234567890] ', ['1234567890'], '[1234567890]');
    assertPath('opt0', ['opt0'], 'opt0');
    assertPath('$foo.$bar._baz', ['$foo', '$bar', '_baz'], '$foo.$bar._baz');
    assertPath('foo["baz"]', ['foo', 'baz'], 'foo.baz');
    assertPath('foo["b\\"az"]', ['foo', 'b"az'], 'foo["b\\"az"]');
    assertPath("foo['b\\'az']", ['foo', "b'az"], 'foo["b\'az"]');
    assertPath(['a', 'b'], ['a', 'b'], 'a.b');
    assertPath([''], [''], '[""]');

    function Foo(val) { this.val = val; }
    Foo.prototype.toString = function() { return 'Foo' + this.val; };
    assertPath([new Foo('a'), new Foo('b')], ['Fooa', 'Foob'], 'Fooa.Foob');

    assertInvalidPath('.');
    assertInvalidPath(' . ');
    assertInvalidPath('..');
    assertInvalidPath('a[4');
    assertInvalidPath('a.b.');
    assertInvalidPath('a,b');
    assertInvalidPath('a["foo]');
    assertInvalidPath('[0x04]');
    assertInvalidPath('[0foo]');
    assertInvalidPath('[foo-bar]');
    assertInvalidPath('foo-bar');
    assertInvalidPath('42');
    assertInvalidPath('a[04]');
    assertInvalidPath(' a [ 04 ]');
    assertInvalidPath('  42   ');
    assertInvalidPath('foo["bar]');
    assertInvalidPath("foo['bar]");
  });

  it('Paths are interned', function() {
    var p = KeyPath.get('foo.bar');
    var p2 = KeyPath.get('foo.bar');
    assert.strictEqual(p, p2);

    var p3 = KeyPath.get('');
    var p4 = KeyPath.get('');
    assert.strictEqual(p3, p4);
  });

  it('null is empty path', function() {
    assert.strictEqual(KeyPath.get(''), KeyPath.get(null));
  });

  it('undefined is empty path', function() {
    assert.strictEqual(KeyPath.get(undefined), KeyPath.get(null));
  });

  it('KeyPath.getValueFrom', function() {
    var obj = {
      a: {
        b: {
          c: 1
        }
      }
    };

    var p1 = KeyPath.get('a');
    var p2 = KeyPath.get('a.b');
    var p3 = KeyPath.get('a.b.c');

    assert.strictEqual(obj.a, p1.getValueFrom(obj));
    assert.strictEqual(obj.a.b, p2.getValueFrom(obj));
    assert.strictEqual(1, p3.getValueFrom(obj));

    obj.a.b.c = 2;
    assert.strictEqual(2, p3.getValueFrom(obj));

    obj.a.b = {
      c: 3
    };
    assert.strictEqual(3, p3.getValueFrom(obj));

    obj.a = {
      b: 4
    };
    assert.strictEqual(undefined, p3.getValueFrom(obj));
    assert.strictEqual(4, p2.getValueFrom(obj));
  });

  it('KeyPath.setValueFrom', function() {
    var obj = {};

    KeyPath.get('foo').setValueFrom(obj, 3);
    assert.equal(3, obj.foo);

    var bar = { baz: 3 };

    KeyPath.get('bar').setValueFrom(obj, bar);
    assert.equal(bar, obj.bar);

    var p = KeyPath.get('bar.baz.bat');
    p.setValueFrom(obj, 'not here');
    assert.equal(undefined, p.getValueFrom(obj));
  });

  it('Degenerate Values', function() {
    var emptyPath = KeyPath.get();
    var foo = {};

    assert.equal(emptyPath.getValueFrom(null), null);
    assert.equal(emptyPath.getValueFrom(foo), foo);
    assert.equal(emptyPath.getValueFrom(3), 3);
    assert.equal(KeyPath.get('a').getValueFrom(undefined), undefined);
  });

  it('Variadic Call', function() {
    var bar1 = KeyPath.get('foo.bar1');
    var bar2 = KeyPath.get('foo.bar2');

    var arr = KeyPath.getAll('foo.bar1', 'foo.bar2');

    assert.strictEqual(arr[0], bar1);
    assert.strictEqual(arr[1], bar2);
  });

  it('Usage Demo', function() {
    var obj = {
      identifier: [
        'some value',
        {
          'string with space': 'you got me!'
        }
      ]
    };

    var kp = KeyPath.get(['identifier', 1, 'string with space']);
    assert.equal('you got me!', kp.getValueFrom(obj));

    kp = KeyPath.get("identifier[1]['string with space']");
    assert.equal('you got me!', kp.getValueFrom(obj));

    kp.setValueFrom(obj, 'something else');
    assert.equal('something else', obj.identifier[1]['string with space']);
  });
});
