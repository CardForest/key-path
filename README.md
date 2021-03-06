#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]

> Deep property accessors for JavaScript objects.

Originally taken from [Polymer observe-js](https://github.com/Polymer/observe-js)

## Install

```sh
$ npm install --save key-path
```


## Usage

```js
var KeyPath = require('key-path');

var kp = KeyPath.get(['identifier', 1, 'string with space']);
// OR
var kp = KeyPath.get("identifier[1]['string with space']");

var obj = {
  identifier: [
    'some value',
    {
      'string with space': 'you got me!'
    }
  ]
}

assert kp.getValueFrom(obj) === 'you got me!'

kp.setValueFrom(obj, 'something else');
assert  obj.identifier[1]['string with space'] === 'something else'
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

## Development

```sh
# run tests
$ npm test

# creates browser.js using browserify
$ npm run browser
```


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
