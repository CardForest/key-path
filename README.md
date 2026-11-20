# Deep property accessors for JavaScript objects.

Originally taken from [Polymer observe-js](https://github.com/Polymer/observe-js)

## Install

```sh
$ npm install --save key-path
```


## Usage

```js
const assert = require('node:assert/strict');
const KeyPath = require('key-path');

let kp = KeyPath.get(['identifier', 1, 'string with space']);
// OR
kp = KeyPath.get("identifier[1]['string with space']");

const obj = {
  identifier: [
    'some value',
    {
      'string with space': 'you got me!'
    }
  ]
};

assert.equal(kp.getValueFrom(obj), 'you got me!');

kp.setValueFrom(obj, 'something else');
assert.equal(obj.identifier[1]['string with space'], 'something else');
```

## KeyPath Objects

A path is an ECMAScript expression consisting only of identifiers (`myVal`), member accesses (`foo.bar`) and key lookup with literal values (`arr[0]` `obj['str-value'].bar.baz`).

`KeyPath.get('foo.bar.baz')` returns a KeyPath object which represents the path. KeyPath objects have the following API:

```JavaScript
{
  // Returns the current of the path from the provided object. If eval() is available, a compiled getter will be
  // used for better performance.
  getValueFrom: function(obj) { }


  // Attempts to set the value of the path from the provided object. Returns true IFF the path was reachable and
  // set.
  setValueFrom: function(obj, newValue) { }
}
```

- KeyPath objects are interned (e.g., `assert(KeyPath.get('foo.bar.baz') === KeyPath.get('foo.bar.baz'));`).

- `KeyPath.getAll` can be used for making a variadic call to `KeyPath.get`. That is, if you call it with a few paths (e.g., `KeyPath.getAll('foo.bar1', 'foo.bar2')`) you will receive an array of KeyPath objects. 

- Paths extend `Array<string>`. Array operations such as `map`, `filter`, and
  `slice` return ordinary arrays.

- When code generation is unavailable (for example, under a strict Content
  Security Policy), getters use ordinary property traversal.

- Setters return `false` when the resolved assignment target is `Object.prototype`
  or `Array.prototype`. Inherited traversal, custom prototypes, and
  prototype-related key names remain supported. This is a targeted safeguard,
  not comprehensive protection against every prototype-related mutation.

## TypeScript

The package includes declarations and retains its CommonJS export:

```ts
import KeyPath = require('key-path');

const parts = ['items', 0, 'name'] as const;
const path = KeyPath.get(parts);
const value = path.getValueFrom({ items: [{ name: 'example' }] });
```

Readonly arrays and array-like objects are accepted as pre-parsed keys.
Getter results remain dynamically typed; the path does not infer the object's
property types.

## Development

```sh
# run tests
$ npm test

# type-check the library and tests without emitting files
$ npm run typecheck

# build the CommonJS module and TypeScript declarations in dist
$ npm run build
```

Generated files in `dist` are ignored by Git. Build output and declarations
are included in the npm package; `npm publish` runs tests and builds them first.

## Publishing

Publishing a stable GitHub release runs `.github/workflows/publish.yml` and
publishes to npm's `latest` tag. Drafts and prereleases do not publish.
The release tag must match the version in `package.json`, with an optional `v`
prefix (for example, `v0.4.0`). Publishing runs type checking, tests, and the build.

Configure an npm trusted publisher in the
[key-path package settings](https://www.npmjs.com/package/key-path/access):

- Provider: GitHub Actions
- Organization or user: `CardForest`
- Repository: `key-path`
- Workflow filename: `publish.yml`
- Environment name: leave empty
- Allowed actions: enable direct publishing with `npm publish`

No npm token or GitHub secret is required. Configure the trusted publisher
shortly before the first release: new configurations expire if they are not used
successfully within two days. See the
[npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

For each release, update the package version and lockfile (for example,
`npm version patch --no-git-tag-version`), commit and push the changes, then
publish a GitHub release targeting that commit with the matching tag.
The workflow requires GitHub Actions to be enabled for this repository.

## Contributors

Thanks to [@CXu0630](https://github.com/CXu0630) for fixing special-character
escaping in compiled getters and adding regression tests
([#3](https://github.com/CardForest/key-path/pull/3)).

## License

Copyright © 2015 [Amit Portnoy](https://github.com/amitport).

Copyright © 2014 The Polymer Project Authors. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google Inc. nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

[npm-image]: https://img.shields.io/npm/v/key-path.svg?style=flat
[npm-url]: https://npmjs.org/package/key-path
[travis-image]: https://travis-ci.org/CardForest/key-path.svg?branch=master
[travis-url]: https://travis-ci.org/CardForest/key-path
[daviddm-image]: https://david-dm.org/CardForest/key-path.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/CardForest/key-path
