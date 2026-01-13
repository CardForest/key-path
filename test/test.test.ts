import { assert, describe, it } from 'vitest';
import KeyPath from '../index';

function assertPath(pathString: any, expectKeys?: string[], expectSerialized?: string) {
  var path = KeyPath.get(pathString);
  if (!expectKeys) {
    if (path.valid) {
      assert.isFalse(path.valid, `Expected invalid path for "${pathString}"`);
    }
    return;
  }

  assert.deepEqual(Array.from(path), expectKeys);
  assert.strictEqual(path.toString(), expectSerialized);
}

function assertInvalidPath(pathString: any) {
  assertPath(pathString);
}

describe('key-path node module', function () {
  it('constructor throws', function () {
    assert.throws(function () {
      // @ts-ignore
      new KeyPath(['foo'], null);
    });
  });

  it('path validity', function () {
    // invalid path get value is always undefined
    var p = KeyPath.get('a b');
    assert.isFalse(p.valid);
    assert.isUndefined(p.getValueFrom({ a: { b: 2 } }));

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

    class Foo {
      val: string;
      constructor(val: string) { this.val = val; }
      toString() { return 'Foo' + this.val; }
    }

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

  it('Paths are interned', function () {
    var p = KeyPath.get('foo.bar');
    var p2 = KeyPath.get('foo.bar');
    var p3 = KeyPath.get(['foo', 'bar']);
    assert.strictEqual(p, p2);
    assert.strictEqual(p3, p2);

    var p4 = KeyPath.get('');
    var p5 = KeyPath.get('');
    assert.strictEqual(p4, p5);
  });

  it('null is empty path', function () {
    assert.strictEqual(KeyPath.get(''), KeyPath.get(null));
  });

  it('undefined is empty path', function () {
    assert.strictEqual(KeyPath.get(undefined), KeyPath.get(null));
  });

  it('KeyPath.getValueFrom', function () {
    var obj: any = {
      a: {
        b: {
          c: 1
        }
      }
    };

    var p1 = KeyPath.get('a');
    var p2 = KeyPath.get('a.b');
    var p3 = KeyPath.get('a.b.c');

    assert.strictEqual(p1.getValueFrom(obj), obj.a);
    assert.strictEqual(p2.getValueFrom(obj), obj.a.b);
    assert.strictEqual(p3.getValueFrom(obj), 1);

    obj.a.b.c = 2;
    assert.strictEqual(p3.getValueFrom(obj), 2);

    obj.a.b = {
      c: 3
    };
    assert.strictEqual(p3.getValueFrom(obj), 3);

    obj.a = {
      b: 4
    };
    assert.strictEqual(p3.getValueFrom(obj), undefined);
    assert.strictEqual(p2.getValueFrom(obj), 4);
  });

  it('KeyPath.setValueFrom', function () {
    var obj: any = {};

    KeyPath.get('foo').setValueFrom(obj, 3);
    assert.equal(obj.foo, 3);

    var bar = { baz: 3 };

    KeyPath.get('bar').setValueFrom(obj, bar);
    assert.equal(obj.bar, bar);

    var p = KeyPath.get('bar.baz.bat');
    p.setValueFrom(obj, 'not here');
    assert.equal(p.getValueFrom(obj), undefined);
  });

  it('Degenerate Values', function () {
    var emptyPath = KeyPath.get();
    var foo = {};

    assert.equal(emptyPath.getValueFrom(null), null);
    assert.equal(emptyPath.getValueFrom(foo), foo);
    assert.equal(emptyPath.getValueFrom(3), 3);
    assert.equal(KeyPath.get('a').getValueFrom(undefined), undefined);
  });

  it('Variadic Call', function () {
    var bar1 = KeyPath.get('foo.bar1');
    var bar2 = KeyPath.get('foo.bar2');

    var arr = KeyPath.getAll('foo.bar1', 'foo.bar2');

    assert.strictEqual(arr[0], bar1);
    assert.strictEqual(arr[1], bar2);
  });

  it('Usage Demo', function () {
    var obj: any = {
      identifier: [
        'some value',
        {
          'string with space': 'you got me!'
        }
      ]
    };

    var kp = KeyPath.get(['identifier', 1, 'string with space']);
    assert.equal(kp.getValueFrom(obj), 'you got me!');

    kp = KeyPath.get("identifier[1]['string with space']");
    assert.equal(kp.getValueFrom(obj), 'you got me!');

    kp.setValueFrom(obj, 'something else');
    assert.equal(obj.identifier[1]['string with space'], 'something else');
  });
});
