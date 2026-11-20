import { assert, describe, it, vi } from 'vitest';
import KeyPath from '../index';

function assertPath(pathString: unknown, expectKeys?: string[], expectSerialized?: string) {
  const path = KeyPath.get(pathString);
  if (!expectKeys) {
    assert.isFalse(path.valid, `Expected invalid path for "${pathString}"`);
    return;
  }

  assert.deepEqual(Array.from(path), expectKeys);
  assert.strictEqual(path.toString(), expectSerialized);
}

function assertInvalidPath(pathString: unknown) {
  assertPath(pathString);
}

describe('key-path node module', function () {
  it('constructor throws', function () {
    assert.throws(function () {
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

  it('rejects writes targeting Object.prototype or Array.prototype', function () {
    const marker = '__keyPathPrototypeTest';
    try {
      for (const prototype of [Object.prototype, Array.prototype]) {
        for (const input of [marker, [marker]]) {
          assert.isFalse(KeyPath.get(input).setValueFrom(prototype, 42));
        }
        assert.isFalse(KeyPath.get(['alias', marker]).setValueFrom({ alias: prototype }, 42));
        assert.isFalse(Object.prototype.hasOwnProperty.call(prototype, marker));
      }

      for (const object of [{}, []]) {
        for (const input of [
          `__proto__.${marker}`,
          ['__proto__', marker],
          `constructor.prototype.${marker}`,
          ['constructor', 'prototype', marker],
        ]) {
          assert.isFalse(KeyPath.get(input).setValueFrom(object, 42));
          assert.isFalse(Object.prototype.hasOwnProperty.call(Object.prototype, marker));
          assert.isFalse(Object.prototype.hasOwnProperty.call(Array.prototype, marker));
        }
      }
    } finally {
      Reflect.deleteProperty(Object.prototype, marker);
      Reflect.deleteProperty(Array.prototype, marker);
    }
  });

  it('still sets inherited properties, custom prototypes, and prototype-related keys', function () {
    const shared = { leaf: 1 };
    const object = Object.create({ inherited: shared });
    assert.isTrue(KeyPath.get('inherited.leaf').setValueFrom(object, 2));
    assert.strictEqual(shared.leaf, 2);

    const customPrototype = { leaf: 1 };
    const instance = Object.create(customPrototype);
    assert.isTrue(KeyPath.get('__proto__.leaf').setValueFrom(instance, 2));
    assert.strictEqual(customPrototype.leaf, 2);

    const data = { constructor: { prototype: { leaf: 1 } } };
    assert.isTrue(KeyPath.get('constructor.prototype.leaf').setValueFrom(data, 2));
    assert.strictEqual(data.constructor.prototype.leaf, 2);

    const dictionary = Object.create(null);
    assert.isTrue(KeyPath.get('__proto__').setValueFrom(dictionary, 42));
    assert.strictEqual(dictionary.__proto__, 42);

    const replacement = { leaf: 3 };
    const ordinary = {};
    assert.isTrue(KeyPath.get('__proto__').setValueFrom(ordinary, replacement));
    assert.strictEqual(Object.getPrototypeOf(ordinary), replacement);
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

  it('compiled getter does not execute code in keys', function () {
    var g: any = globalThis;
    delete g.__kpInjected;

    // string path: backslash before the quote used to close the generated string literal
    var p1 = KeyPath.get("['\\\"+(globalThis.__kpInjected=1)];//']");
    assert.isTrue(p1.valid);
    assert.isUndefined(p1.getValueFrom({ a: 1 }));
    assert.isUndefined(g.__kpInjected);

    // array path: bypasses the parser
    var p2 = KeyPath.get(['\\"]+(globalThis.__kpInjected=2)//']);
    assert.isUndefined(p2.getValueFrom({ a: 1 }));
    assert.isUndefined(g.__kpInjected);
  });

  it('compiled getter matches property access for special-character keys', function () {
    var keys = ['a\\b', 'a"b', "a'b", 'a\nb', String.fromCharCode(0x2028), '0x10', '0', '16'];
    var obj: any = { 16: 'sixteen' };
    keys.forEach(function (k, i) { obj[k] = i; });

    keys.forEach(function (k) {
      assert.strictEqual(KeyPath.get([k]).getValueFrom(obj), obj[k], JSON.stringify(k));
      assert.strictEqual(KeyPath.get(['x', k]).getValueFrom({ x: obj }), obj[k], 'nested ' + JSON.stringify(k));
    });
  });

  it('interns keys that match Object prototype properties', function () {
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      const path = KeyPath.get(key);
      const object = { [key]: 'expected' };
      assert.instanceOf(path, KeyPath);
      assert.strictEqual(path.getValueFrom(object), 'expected');
      assert.strictEqual(KeyPath.get([key]), path);
    }
  });

  it('accepts readonly and array-like keys', function () {
    const parts = ['root', 0, 'leaf'] as const;
    const path = KeyPath.get(parts);
    assert.strictEqual(KeyPath.get({ 0: 'root', 1: 0, 2: 'leaf', length: 3 }), path);
    assert.strictEqual(KeyPath.get({ 0: 'root', 1: 0, 2: 'leaf', length: '3' }), path);
    assert.strictEqual(KeyPath.getAll(parts, path)[0], path);
    assert.strictEqual(path.getValueFrom({ root: [{ leaf: 42 }] }), 42);
  });

  it('supports inherited array operations without constructing a Path', function () {
    const path = KeyPath.get('species.root.leaf');
    assert.deepEqual(path.map(key => key.toUpperCase()), ['SPECIES', 'ROOT', 'LEAF']);
    assert.deepEqual(path.slice(1), ['root', 'leaf']);
    assert.deepEqual(path.filter(key => key !== 'root'), ['species', 'leaf']);
    assert.isFalse(path.slice() instanceof KeyPath);
    assert.strictEqual(KeyPath.get('species.root.leaf'), path);
  });

  it('compiles an empty path as the identity getter', function () {
    const getter = KeyPath.get().compiledGetValueFromFn();
    const object = {};
    assert.strictEqual(getter(object), object);
    assert.strictEqual(getter(null), null);
    assert.strictEqual(getter(42), 42);
  });

  it('uses the interpreted getter when code generation is unavailable', async function () {
    vi.resetModules();
    vi.stubGlobal('Function', function () {
      throw new EvalError('Code generation is disabled');
    });
    try {
      const { default: SafePath } = await import('../index');
      const key = 'a\\b\n"';
      const path = SafePath.get(['root', key]);
      const object = { root: { [key]: 42 } };
      assert.strictEqual(path.getValueFrom, SafePath.prototype.getValueFrom);
      assert.strictEqual(path.getValueFrom(object), 42);
      assert.isUndefined(path.getValueFrom({ root: null }));
      assert.strictEqual(SafePath.get('length').getValueFrom('abc'), 3);
      assert.isTrue(path.setValueFrom(object, 7));
      assert.strictEqual(object.root[key], 7);
      assert.isFalse(path.setValueFrom({ root: null }, 7));
      assert.isFalse(SafePath.get().setValueFrom(object, 7));
      assert.isUndefined(SafePath.get('a[').getValueFrom(object));
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});
