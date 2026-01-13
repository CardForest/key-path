"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = __importDefault(require("../index"));
function assertPath(pathString, expectKeys, expectSerialized) {
    var path = index_1.default.get(pathString);
    if (!expectKeys) {
        if (path.valid) {
            vitest_1.assert.isFalse(path.valid, `Expected invalid path for "${pathString}"`);
        }
        return;
    }
    vitest_1.assert.deepEqual(Array.from(path), expectKeys);
    vitest_1.assert.strictEqual(path.toString(), expectSerialized);
}
function assertInvalidPath(pathString) {
    assertPath(pathString);
}
(0, vitest_1.describe)('key-path node module', function () {
    (0, vitest_1.it)('constructor throws', function () {
        vitest_1.assert.throws(function () {
            // @ts-ignore
            new index_1.default(['foo'], null);
        });
    });
    (0, vitest_1.it)('path validity', function () {
        // invalid path get value is always undefined
        var p = index_1.default.get('a b');
        vitest_1.assert.isFalse(p.valid);
        vitest_1.assert.isUndefined(p.getValueFrom({ a: { b: 2 } }));
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
            constructor(val) { this.val = val; }
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
    (0, vitest_1.it)('Paths are interned', function () {
        var p = index_1.default.get('foo.bar');
        var p2 = index_1.default.get('foo.bar');
        var p3 = index_1.default.get(['foo', 'bar']);
        vitest_1.assert.strictEqual(p, p2);
        vitest_1.assert.strictEqual(p3, p2);
        var p4 = index_1.default.get('');
        var p5 = index_1.default.get('');
        vitest_1.assert.strictEqual(p4, p5);
    });
    (0, vitest_1.it)('null is empty path', function () {
        vitest_1.assert.strictEqual(index_1.default.get(''), index_1.default.get(null));
    });
    (0, vitest_1.it)('undefined is empty path', function () {
        vitest_1.assert.strictEqual(index_1.default.get(undefined), index_1.default.get(null));
    });
    (0, vitest_1.it)('KeyPath.getValueFrom', function () {
        var obj = {
            a: {
                b: {
                    c: 1
                }
            }
        };
        var p1 = index_1.default.get('a');
        var p2 = index_1.default.get('a.b');
        var p3 = index_1.default.get('a.b.c');
        vitest_1.assert.strictEqual(p1.getValueFrom(obj), obj.a);
        vitest_1.assert.strictEqual(p2.getValueFrom(obj), obj.a.b);
        vitest_1.assert.strictEqual(p3.getValueFrom(obj), 1);
        obj.a.b.c = 2;
        vitest_1.assert.strictEqual(p3.getValueFrom(obj), 2);
        obj.a.b = {
            c: 3
        };
        vitest_1.assert.strictEqual(p3.getValueFrom(obj), 3);
        obj.a = {
            b: 4
        };
        vitest_1.assert.strictEqual(p3.getValueFrom(obj), undefined);
        vitest_1.assert.strictEqual(p2.getValueFrom(obj), 4);
    });
    (0, vitest_1.it)('KeyPath.setValueFrom', function () {
        var obj = {};
        index_1.default.get('foo').setValueFrom(obj, 3);
        vitest_1.assert.equal(obj.foo, 3);
        var bar = { baz: 3 };
        index_1.default.get('bar').setValueFrom(obj, bar);
        vitest_1.assert.equal(obj.bar, bar);
        var p = index_1.default.get('bar.baz.bat');
        p.setValueFrom(obj, 'not here');
        vitest_1.assert.equal(p.getValueFrom(obj), undefined);
    });
    (0, vitest_1.it)('Degenerate Values', function () {
        var emptyPath = index_1.default.get();
        var foo = {};
        vitest_1.assert.equal(emptyPath.getValueFrom(null), null);
        vitest_1.assert.equal(emptyPath.getValueFrom(foo), foo);
        vitest_1.assert.equal(emptyPath.getValueFrom(3), 3);
        vitest_1.assert.equal(index_1.default.get('a').getValueFrom(undefined), undefined);
    });
    (0, vitest_1.it)('Variadic Call', function () {
        var bar1 = index_1.default.get('foo.bar1');
        var bar2 = index_1.default.get('foo.bar2');
        var arr = index_1.default.getAll('foo.bar1', 'foo.bar2');
        vitest_1.assert.strictEqual(arr[0], bar1);
        vitest_1.assert.strictEqual(arr[1], bar2);
    });
    (0, vitest_1.it)('Usage Demo', function () {
        var obj = {
            identifier: [
                'some value',
                {
                    'string with space': 'you got me!'
                }
            ]
        };
        var kp = index_1.default.get(['identifier', 1, 'string with space']);
        vitest_1.assert.equal(kp.getValueFrom(obj), 'you got me!');
        kp = index_1.default.get("identifier[1]['string with space']");
        vitest_1.assert.equal(kp.getValueFrom(obj), 'you got me!');
        kp.setValueFrom(obj, 'something else');
        vitest_1.assert.equal(obj.identifier[1]['string with space'], 'something else');
    });
});
