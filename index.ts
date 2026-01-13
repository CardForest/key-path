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
 *
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

// Declare chrome global
declare var chrome: any;

function detectEval(): boolean {
  // Don't test for eval if we're running in a Chrome App environment.
  // We check for APIs set that only exist in a Chrome App context.
  if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
    return false;
  }

  // Firefox OS Apps do not allow eval. This feature detection is very hacky
  // but even if some other platform adds support for this function this code
  // will continue to work.
  if (typeof navigator != 'undefined' && (navigator as any).getDeviceStorage) {
    return false;
  }

  try {
    var f = new Function('', 'return true;');
    return f();
  } catch (ex) {
    return false;
  }
}

var hasEval = detectEval();

function isIndex(s: any): boolean {
  return +s === s >>> 0 && s !== '';
}

function isObject(obj: any): boolean {
  return obj === Object(obj);
}

var identStart = '[\$_a-zA-Z]';
var identPart = '[\$_a-zA-Z0-9]';
var identRegExp = new RegExp('^' + identStart + '+' + identPart + '*' + '$');

function getPathCharType(char: string | undefined): string {
  if (char === undefined) {
    return 'eof';
  }

  var code = char.charCodeAt(0);

  switch (code) {
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

interface StateMachine {
  [key: string]: {
    [key: string]: string[];
  };
}

var pathStateMachine: StateMachine = {
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

function noop() { }

function parsePath(path: string): string[] | undefined {
  var keys: string[] = [];
  var index = -1;
  var c: string, newChar: string | undefined, key: string | undefined, type: string, transition: string[] | string, action: Function, typeMap: any, mode = 'beforePath';

  var actions: { [key: string]: Function } = {
    push: function () {
      if (key === undefined) {
        return;
      }

      keys.push(key);
      key = undefined;
    },

    append: function () {
      if (key === undefined) {
        key = newChar;
      } else {
        key += newChar;
      }
    }
  };

  function maybeUnescapeQuote() {
    if (index >= path.length) {
      return;
    }

    var nextChar = path[index + 1];
    if ((mode == 'inSingleQuote' && nextChar == "'") ||
      (mode == 'inDoubleQuote' && nextChar == '"')) {
      index++;
      newChar = nextChar;
      actions['append']();
      return true;
    }
  }

  while (mode) {
    index++;
    c = path[index];

    if (c == '\\' && maybeUnescapeQuote()) {
      continue;
    }

    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    if (!typeMap) {
      console.error('CRASH: typeMap undefined for mode:', mode, 'path:', path);
      throw new Error('StateMachine crash');
    }
    // Cast strict lookup to avoid implicit specific string type inference interfering with 'error' literal
    transition = (typeMap[type] as string[] | undefined) || typeMap['else'] || 'error';

    if (transition === 'error' || (Array.isArray(transition) && transition[0] === 'error')) {
      return; // parse error;
    }

    // Safety cast
    var trans = transition as string[];

    mode = trans[0];
    action = actions[trans[1]] || noop;
    newChar = trans[2] === undefined ? c : trans[2];
    action();

    if (mode === 'afterPath') {
      return keys;
    }
  }
}

function isIdent(s: string) {
  return identRegExp.test(s);
}

var constructorIsPrivate = {};

class Path extends Array<string> {
  valid: boolean = true;

  constructor(parts: string[], privateToken: any) {
    if (privateToken !== constructorIsPrivate) {
      throw Error('Use Path.get to retrieve path objects');
    }
    super(); // Initialize Array

    for (var i = 0; i < parts.length; i++) {
      this.push(String(parts[i]));
    }
    // Optimization: if eval is available, compile the getValueFrom function
    if (hasEval && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  static get(pathString?: string | Path | null | undefined | any[]): Path {
    if (pathString instanceof Path) {
      return pathString;
    }

    if (Array.isArray(pathString)) {
      // Intentionally omitted loop to use cache? 
      // No, original code fell through for arrays too, BUT only if they looked like strings?
      // Original code: if (typeof != string) { if (isIndex(pathString.length)) { ... } }
      // So arrays WERE handled by the cache logic logic.
      // I should remove this explicit Array.isArray check to restore cache behavior for arrays too.
    }

    if (pathString == null || (pathString as any).length === 0) {
      pathString = '';
    }

    if (typeof pathString != 'string') {
      if (isIndex((pathString as any).length)) {
        // Constructed with array-like (pre-parsed) keys
        var newPath = new Path(Array.from(pathString as any).map(String), constructorIsPrivate);
        var newPathString = newPath.toString();
        var cachedPath = pathCache[newPathString];
        if (cachedPath) {
          return cachedPath;
        }
        pathCache[newPathString] = newPath;
        return newPath;
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

  static getAll(...args: (string | Path | null | undefined | any[])[]): Path[] {
    return args.map(p => Path.get(p));
  }

  override toString(): string {
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
  }

  getValueFrom(obj: any): any {
    for (var i = 0; i < this.length; i++) {
      if (obj == null) {
        return;
      }
      obj = obj[this[i]];
    }
    return obj;
  }

  compiledGetValueFromFn(): (obj: any) => any {
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
    return new Function('obj', str) as (obj: any) => any;
  }

  setValueFrom(obj: any, value: any): boolean {
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
}

var pathCache: { [key: string]: Path } = {};

var invalidPath = new Path([], constructorIsPrivate);
invalidPath.valid = false;
invalidPath.getValueFrom = function () { return undefined; };
invalidPath.setValueFrom = function () { return false; };

function formatAccessor(key: string): string {
  if (isIndex(key)) {
    return '[' + key + ']';
  } else {
    return '["' + key.replace(/"/g, '\\"') + '"]';
  }
}

export = Path;
