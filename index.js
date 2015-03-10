/**
 *
 * Copyright (c) 2015 Amit Portnoy.
 *
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following disclaimer
 *    in the documentation and/or other materials provided with the
 *    distribution.
 *    * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.

 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

'use strict';

function detectEval() {
  // Don't test for eval if we're running in a Chrome App environment.
  // We check for APIs set that only exist in a Chrome App context.
  /* global chrome */
  if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
    return false;
  }

  // Firefox OS Apps do not allow eval. This feature detection is very hacky
  // but even if some other platform adds support for this function this code
  // will continue to work.
  if (typeof navigator != 'undefined' && navigator.getDeviceStorage) { // jshint ignore:line
    return false;
  }

  try {
    var f = new Function('', 'return true;'); // jshint ignore:line
    return f();
  } catch (ex) {
    return false;
  }
}

var hasEval = detectEval();

function isIndex(s) {
  return +s === s >>> 0 && s !== '';
}

function isObject(obj) {
  return obj === Object(obj);
}

var createObject = ('__proto__' in {}) ?
  function(obj) { return obj; } :
  function(obj) {
    var proto = obj.__proto__; // jshint ignore:line
    if (!proto) {
      return obj;
    }
    var newObject = Object.create(proto);
    Object.getOwnPropertyNames(obj).forEach(function(name) {
      Object.defineProperty(newObject, name,
        Object.getOwnPropertyDescriptor(obj, name));
    });
    return newObject;
  };

var identStart = '[\$_a-zA-Z]';
var identPart = '[\$_a-zA-Z0-9]';
var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');

function getPathCharType(char) {
  if (char === undefined) {
    return 'eof';
  }

  var code = char.charCodeAt(0);

  switch(code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30: // 0
      return char;

    case 0x5F: // _
    case 0x24: // $
      return 'ident';

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0:  // No-break space
    case 0xFEFF:  // Byte Order Mark
    case 0x2028:  // Line Separator
    case 0x2029:  // Paragraph Separator
      return 'ws';
  }

  // a-z, A-Z
  if ((0x61 <= code && code <= 0x7A) || (0x41 <= code && code <= 0x5A)) {
    return 'ident';
  }

  // 1-9
  if (0x31 <= code && code <= 0x39) {
    return 'number';
  }

  return 'else';
}

var pathStateMachine = {
  'beforePath': {
    'ws': ['beforePath'],
    'ident': ['inIdent', 'append'],
    '[': ['beforeElement'],
    'eof': ['afterPath']
  },

  'inPath': {
    'ws': ['inPath'],
    '.': ['beforeIdent'],
    '[': ['beforeElement'],
    'eof': ['afterPath']
  },

  'beforeIdent': {
    'ws': ['beforeIdent'],
    'ident': ['inIdent', 'append']
  },

  'inIdent': {
    'ident': ['inIdent', 'append'],
    '0': ['inIdent', 'append'],
    'number': ['inIdent', 'append'],
    'ws': ['inPath', 'push'],
    '.': ['beforeIdent', 'push'],
    '[': ['beforeElement', 'push'],
    'eof': ['afterPath', 'push']
  },

  'beforeElement': {
    'ws': ['beforeElement'],
    '0': ['afterZero', 'append'],
    'number': ['inIndex', 'append'],
    "'": ['inSingleQuote', 'append', ''],
    '"': ['inDoubleQuote', 'append', '']
  },

  'afterZero': {
    'ws': ['afterElement', 'push'],
    ']': ['inPath', 'push']
  },

  'inIndex': {
    '0': ['inIndex', 'append'],
    'number': ['inIndex', 'append'],
    'ws': ['afterElement'],
    ']': ['inPath', 'push']
  },

  'inSingleQuote': {
    "'": ['afterElement'],
    'eof': ['error'],
    'else': ['inSingleQuote', 'append']
  },

  'inDoubleQuote': {
    '"': ['afterElement'],
    'eof': ['error'],
    'else': ['inDoubleQuote', 'append']
  },

  'afterElement': {
    'ws': ['afterElement'],
    ']': ['inPath', 'push']
  }
};

function noop() {}

function parsePath(path) {
  var keys = [];
  var index = -1;
  var c, newChar, key, type, transition, action, typeMap, mode = 'beforePath';

  var actions = {
    push: function() {
      if (key === undefined) {
        return;
      }

      keys.push(key);
      key = undefined;
    },

    append: function() {
      if (key === undefined) {
        key = newChar;
      } else {
        key += newChar;
      }
    }
  };

  function maybeUnescapeQuote() {
    if (index >= path.length) {// jshint ignore:line
      return;
    }

    var nextChar = path[index + 1];
    if ((mode == 'inSingleQuote' && nextChar == "'") || // jshint ignore:line
      (mode == 'inDoubleQuote' && nextChar == '"')) { // jshint ignore:line
      index++;
      newChar = nextChar;
      actions.append();
      return true;
    }
  }

  while (mode) {
    index++;
    c = path[index];

    if (c == '\\' && maybeUnescapeQuote(mode)) { // jshint ignore:line
      continue;
    }

    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    transition = typeMap[type] || typeMap['else'] || 'error';

    if (transition == 'error') { // jshint ignore:line
      return; // parse error;
    }

    mode = transition[0];
    action = actions[transition[1]] || noop;
    newChar = transition[2] === undefined ? c : transition[2];
    action();

    if (mode === 'afterPath') {
      return keys;
    }
  }
}

function isIdent(s) {
  return identRegExp.test(s);
}

var constructorIsPrivate = {};

function Path(parts, privateToken) {
  if (privateToken !== constructorIsPrivate) {
    throw Error('Use Path.get to retrieve path objects');
  }

  for (var i = 0; i < parts.length; i++) {
    this.push(String(parts[i]));
  }

  if (hasEval && this.length) {
    this.getValueFrom = this.compiledGetValueFromFn();
  }
}

var pathCache = {};

var invalidPath = new Path('', constructorIsPrivate);
invalidPath.valid = false;
invalidPath.getValueFrom = invalidPath.setValueFrom = function() {};

function getPath(pathString) {
  if (pathString instanceof Path) {
    return pathString;
  }

  if (pathString == null || pathString.length == 0) { // jshint ignore:line
    pathString = '';
  }

  if (typeof pathString != 'string') { // jshint ignore:line
    if (isIndex(pathString.length)) {
      // Constructed with array-like (pre-parsed) keys
      return new Path(pathString, constructorIsPrivate);
    }

    pathString = String(pathString);
  }

  var path = pathCache[pathString];
  if (path) {
    return path;
  }

  var parts = parsePath(pathString);
  if (!parts) {
    return invalidPath;
  }

  path = new Path(parts, constructorIsPrivate);
  pathCache[pathString] = path;
  return path;
}

Path.get = function() {
  if (arguments.length >= 2) {
    // support variadic call
    return Array.prototype.slice.call(arguments).map(function(p) {
      return getPath(p);
    });
  } else {
    return getPath.apply(Path, arguments);
  }
};

function formatAccessor(key) {
  if (isIndex(key)) {
    return '[' + key + ']';
  } else {
    return '["' + key.replace(/"/g, '\\"') + '"]';
  }
}

Path.prototype = createObject({
  __proto__: [], // jshint ignore:line
  valid: true,

  toString: function() {
    var pathString = '';
    for (var i = 0; i < this.length; i++) {
      var key = this[i];
      if (isIdent(key)) {
        pathString += i ? '.' + key : key;
      } else {
        pathString += formatAccessor(key);
      }
    }

    return pathString;
  },

  getValueFrom: function(obj) {
    for (var i = 0; i < this.length; i++) {
      if (obj == null) {
        return;
      }
      obj = obj[this[i]];
    }
    return obj;
  },

  // un-comment this if/when someone needs it:
  //iterateObjects: function(obj, visit) {
  //  for (var i = 0; i < this.length; i++) {
  //    if (i) {
  //      obj = obj[this[i - 1]];
  //    }
  //    if (!isObject(obj)) {
  //      return;
  //    }
  //    visit(obj, this[i]);
  //  }
  //},

  compiledGetValueFromFn: function() {
    var str = '';
    var pathString = 'obj';
    str += 'if (obj != null';
    var i = 0;
    var key;
    for (; i < (this.length - 1); i++) {
      key = this[i];
      pathString += isIdent(key) ? '.' + key : formatAccessor(key);
      str += ' &&\n     ' + pathString + ' != null';
    }
    str += ')\n';

    key = this[i];
    pathString += isIdent(key) ? '.' + key : formatAccessor(key);

    str += '  return ' + pathString + ';\nelse\n  return undefined;';
    return new Function('obj', str); // jshint ignore:line
  },

  setValueFrom: function(obj, value) {
    if (!this.length) {
      return false;
    }

    for (var i = 0; i < this.length - 1; i++) {
      if (!isObject(obj)) {
        return false;
      }
      obj = obj[this[i]];
    }

    if (!isObject(obj)) {
      return false;
    }

    obj[this[i]] = value;
    return true;
  }
});

module.exports = Path;
