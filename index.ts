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

declare const chrome: { app?: { runtime?: unknown } } | undefined;

function detectEval(): boolean {
  // Don't test for eval if we're running in a Chrome App environment.
  // We check for APIs set that only exist in a Chrome App context.
  if (typeof chrome !== 'undefined' && chrome.app && chrome.app.runtime) {
    return false;
  }

  // Firefox OS Apps do not allow eval. This feature detection is very hacky
  // but even if some other platform adds support for this function this code
  // will continue to work.
  if (typeof navigator !== 'undefined' && 'getDeviceStorage' in navigator && navigator.getDeviceStorage) {
    return false;
  }

  try {
    return new Function('return true;')();
  } catch {
    return false;
  }
}

const hasEval = detectEval();

function isIndex(value: unknown): boolean {
  const index = Number(value);
  return index === index >>> 0 && value !== '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function getProperty(value: unknown, key: string): unknown {
  return (Object(value) as Record<string, unknown>)[key];
}

function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return value != null && isIndex(getProperty(value, 'length'));
}

const identRegExp = /^[$_a-zA-Z][$_a-zA-Z0-9]*$/;

type PathCharType = 'eof' | '[' | ']' | '.' | '"' | "'" | '0' | 'ident' | 'ws' | 'number' | 'else';
type ParserState = 'beforePath' | 'inPath' | 'beforeIdent' | 'inIdent' |
  'beforeElement' | 'afterZero' | 'inIndex' | 'inSingleQuote' | 'inDoubleQuote' | 'afterElement';
type Action = 'push' | 'append';
type Transition = readonly [ParserState | 'afterPath' | 'error', Action?, string?];

function getPathCharType(char: string | undefined): PathCharType {
  if (char === undefined) {
    return 'eof';
  }
  if (char === '[' || char === ']' || char === '.' || char === '"' || char === "'" || char === '0') {
    return char;
  }

  const code = char.charCodeAt(0);

  switch (code) {
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

const pathStateMachine: Record<ParserState, Partial<Record<PathCharType, Transition>>> = {
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

function parsePath(path: string): string[] | undefined {
  const keys: string[] = [];
  let index = -1;
  let newChar: string | undefined;
  let key: string | undefined;
  let mode: ParserState = 'beforePath';

  const actions: Record<Action, () => void> = {
    push() {
      if (key === undefined) {
        return;
      }

      keys.push(key);
      key = undefined;
    },

    append() {
      if (newChar !== undefined) {
        key = (key ?? '') + newChar;
      }
    }
  };

  while (true) {
    index++;
    const char = path[index];
    const quote = mode === 'inSingleQuote' ? "'" : mode === 'inDoubleQuote' ? '"' : undefined;
    if (char === '\\' && quote !== undefined && path[index + 1] === quote) {
      index++;
      newChar = quote;
      actions.append();
      continue;
    }

    const typeMap: Partial<Record<PathCharType, Transition>> = pathStateMachine[mode];
    const transition: Transition | undefined = typeMap[getPathCharType(char)] ?? typeMap.else;
    if (!transition || transition[0] === 'error') {
      return undefined;
    }

    const [nextMode, action, replacement] = transition;
    newChar = replacement ?? char;
    if (action) {
      actions[action]();
    }

    if (nextMode === 'afterPath') {
      return keys;
    }
    mode = nextMode;
  }
}

function isIdent(s: string) {
  return identRegExp.test(s);
}

const constructorIsPrivate = Symbol('Path constructor');

class Path extends Array<string> {
  valid = true;

  constructor(parts: readonly unknown[], privateToken: unknown) {
    if (privateToken !== constructorIsPrivate) {
      throw Error('Use Path.get to retrieve path objects');
    }
    super();

    for (const part of parts) {
      this.push(String(part));
    }
    // Optimization: if eval is available, compile the getValueFrom function
    if (hasEval && this.length) {
      this.getValueFrom = this.compiledGetValueFromFn();
    }
  }

  static override get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  static get(input?: unknown): Path {
    if (input instanceof Path) {
      return input;
    }

    if (input == null || getProperty(input, 'length') === 0) {
      input = '';
    }

    if (typeof input !== 'string' && isArrayLike(input)) {
      const newPath = new Path(Array.from(input), constructorIsPrivate);
      const newPathString = newPath.toString();
      const cachedPath = pathCache.get(newPathString);
      if (cachedPath) {
        return cachedPath;
      }
      pathCache.set(newPathString, newPath);
      return newPath;
    }

    const pathString = String(input);
    let path = pathCache.get(pathString);
    if (path) {
      return path;
    }

    const parts = parsePath(pathString);
    if (!parts) {
      return invalidPath;
    }

    path = new Path(parts, constructorIsPrivate);
    pathCache.set(pathString, path);
    return path;
  }

  static getAll(...args: unknown[]): Path[] {
    return args.map(p => Path.get(p));
  }

  override toString(): string {
    let pathString = '';
    for (let i = 0; i < this.length; i++) {
      const key = this[i];
      if (isIdent(key)) {
        pathString += i ? '.' + key : key;
      } else {
        pathString += formatAccessor(key);
      }
    }
    return pathString;
  }

  getValueFrom(obj: unknown): any {
    for (const key of this) {
      if (obj == null) {
        return;
      }
      obj = getProperty(obj, key);
    }
    return obj;
  }

  compiledGetValueFromFn(): (obj: unknown) => any {
    if (!this.length) {
      return obj => obj;
    }
    let str = '';
    let pathString = 'obj';
    str += 'if (obj != null';
    let i = 0;
    let key;
    for (; i < (this.length - 1); i++) {
      key = this[i];
      pathString += isIdent(key) ? '.' + key : formatCompiledAccessor(key);
      str += ' &&\n     ' + pathString + ' != null';
    }
    str += ')\n';

    key = this[i];
    pathString += isIdent(key) ? '.' + key : formatCompiledAccessor(key);

    str += '  return ' + pathString + ';\nelse\n  return undefined;';
    return new Function('obj', str) as (obj: unknown) => any;
  }

  setValueFrom(obj: unknown, value: unknown): boolean {
    if (!this.length) {
      return false;
    }

    let i = 0;
    for (; i < this.length - 1; i++) {
      if (!isObject(obj)) {
        return false;
      }
      obj = obj[this[i]];
    }

    if (obj === Object.prototype || obj === Array.prototype || !isObject(obj)) {
      return false;
    }

    obj[this[i]] = value;
    return true;
  }
}

const pathCache = new Map<string, Path>();

const invalidPath = new Path([], constructorIsPrivate);
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

// Used only when generating source for compiledGetValueFromFn. JSON.stringify
// produces a valid JS string literal for any key (backslashes, quotes, line
// terminators); U+2028/U+2029 are escaped for pre-ES2019 engines.
function formatCompiledAccessor(key: string): string {
  return '[' + JSON.stringify(key)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029') + ']';
}

export = Path;
