/***********************************************************************

  A JavaScript tokenizer / parser / beautifier / compressor.
  https://github.com/mishoo/UglifyJS2

  -------------------------------- (C) ---------------------------------

                           Author: Mihai Bazon
                         <mihai.bazon@gmail.com>
                       http://mihai.bazon.net/blog

  Distributed under the BSD license:

    Copyright 2012 (c) Mihai Bazon <mihai.bazon@gmail.com>

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

        * Redistributions of source code must retain the above
          copyright notice, this list of conditions and the following
          disclaimer.

        * Redistributions in binary form must reproduce the above
          copyright notice, this list of conditions and the following
          disclaimer in the documentation and/or other materials
          provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER “AS IS” AND ANY
    EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
    IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
    PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
    LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
    OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
    TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
    THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
    SUCH DAMAGE.

 ***********************************************************************/

'use strict'

import {
  defaults,
  makePredicate,
  noop,
  return_false,
  return_true
} from './utils'
import AST_Node from './ast/node'
import TreeWalker from './tree-walker'
import {
  get_full_char_code,
  get_full_char,
  is_identifier_char
} from './parse'

const EXPECT_DIRECTIVE = /^$|[;{][\s\n]*$/
const CODE_LINE_BREAK = 10
const CODE_SPACE = 32

const r_annotation = /[@#]__(PURE|INLINE|NOINLINE)__/g
const requireSemicolonChars = makePredicate('( [ + * / - , . `')

function is_some_comments (comment: any) {
  // multiline comment
  return (
    (comment.type === 'comment2' || comment.type === 'comment1') &&
        /@preserve|@lic|@cc_on|^\**!/i.test(comment.value)
  )
}

class OutputStreamInner {
  get: any
  toString: any
  indent: any
  in_directive: boolean
  use_asm: any
  active_scope: any
  indentation: Function
  current_width: Function
  should_break: Function
  has_parens: Function
  newline: any
  print: any
  star: any
  space: any
  comma: any
  colon: any
  last: Function
  semicolon: any
  force_semicolon: any
  to_utf8: any
  print_name: Function
  print_string: Function
  print_template_string_chars: Function
  encode_string: any
  next_indent: any
  with_indent: any
  with_block: any
  with_parens: any
  with_square: any
  add_mapping: Function
  option: Function
  printed_comments: any
  prepend_comments: any
  append_comments: Function
  line: Function
  col: Function
  pos: Function
  push_node: Function
  pop_node: Function
  parent: Function

  constructor (opt?: any) {
    var _readonly = !opt
    const _options: any = defaults(opt, {
      ascii_only: false,
      beautify: false,
      braces: false,
      comments: 'some',
      ecma: 5,
      ie8: false,
      indent_level: 4,
      indent_start: 0,
      inline_script: true,
      keep_numbers: false,
      keep_quoted_props: false,
      max_line_len: false,
      preamble: null,
      preserve_annotations: false,
      quote_keys: false,
      quote_style: 0,
      safari10: false,
      semicolons: true,
      shebang: true,
      shorthand: undefined,
      source_map: null,
      webkit: false,
      width: 80,
      wrap_iife: false,
      wrap_func_args: true
    }, true)

    if (_options.shorthand === undefined) { _options.shorthand = _options.ecma as number > 5 }

    // Convert comment option to RegExp if neccessary and set up comments filter
    var _comment_filter: any = return_false // Default case, throw all comments away
    if (_options.comments) {
      let comments = _options.comments
      if (typeof _options.comments === 'string' && /^\/.*\/[a-zA-Z]*$/.test(_options.comments)) {
        var regex_pos = _options.comments.lastIndexOf('/')
        comments = new RegExp(
          _options.comments.substr(1, regex_pos - 1),
          _options.comments.substr(regex_pos + 1)
        )
      }
      if (comments instanceof RegExp) {
        _comment_filter = function (comment: any) {
          return comment.type != 'comment5' && (comments as RegExp).test(comment.value)
        }
      } else if (typeof comments === 'function') {
        _comment_filter = function (comment: any) {
          return comment.type != 'comment5' && (comments as Function)(this, comment)
        }
      } else if (comments === 'some') {
        _comment_filter = is_some_comments
      } else { // NOTE includes "all" option
        _comment_filter = return_true
      }
    }

    var _indentation = 0
    var _current_col = 0
    var _current_line = 1
    var _current_pos = 0
    var _OUTPUT = ''
    const _printed_comments: Set<any[]> = new Set()

    var _to_utf8 = _options.ascii_only ? function (str: string, identifier?: boolean) {
      if (_options.ecma as number >= 2015) {
        str = str.replace(/[\ud800-\udbff][\udc00-\udfff]/g, function (ch) {
          var code = get_full_char_code(ch, 0).toString(16)
          return '\\u{' + code + '}'
        })
      }
      return str.replace(/[\u0000-\u001f\u007f-\uffff]/g, function (ch) {
        var code = ch.charCodeAt(0).toString(16)
        if (code.length <= 2 && !identifier) {
          while (code.length < 2) code = '0' + code
          return '\\x' + code
        } else {
          while (code.length < 4) code = '0' + code
          return '\\u' + code
        }
      })
    } : function (str: string) {
      return str.replace(/[\ud800-\udbff][\udc00-\udfff]|([\ud800-\udbff]|[\udc00-\udfff])/g, function (match, lone) {
        if (lone) {
          return '\\u' + lone.charCodeAt(0).toString(16)
        }
        return match
      })
    }

    function make_string (str: string, quote: string) {
      var dq = 0; var sq = 0
      str = str.replace(/[\\\b\f\n\r\v\t\x22\x27\u2028\u2029\0\ufeff]/g,
        function (s, i) {
          switch (s) {
            case '"': ++dq; return '"'
            case "'": ++sq; return "'"
            case '\\': return '\\\\'
            case '\n': return '\\n'
            case '\r': return '\\r'
            case '\t': return '\\t'
            case '\b': return '\\b'
            case '\f': return '\\f'
            case '\x0B': return _options.ie8 ? '\\x0B' : '\\v'
            case '\u2028': return '\\u2028'
            case '\u2029': return '\\u2029'
            case '\ufeff': return '\\ufeff'
            case '\0':
              return /[0-9]/.test(get_full_char(str, i + 1)) ? '\\x00' : '\\0'
          }
          return s
        })
      function quote_single () {
        return "'" + str.replace(/\x27/g, "\\'") + "'"
      }
      function quote_double () {
        return '"' + str.replace(/\x22/g, '\\"') + '"'
      }
      function quote_template () {
        return '`' + str.replace(/`/g, '\\`') + '`'
      }
      str = _to_utf8(str)
      if (quote === '`') return quote_template()
      switch (_options.quote_style) {
        case 1:
          return quote_single()
        case 2:
          return quote_double()
        case 3:
          return quote == "'" ? quote_single() : quote_double()
        default:
          return dq > sq ? quote_single() : quote_double()
      }
    }

    function _encode_string (str: string, quote: string) {
      var ret = make_string(str, quote)
      if (_options.inline_script) {
        ret = ret.replace(/<\x2f(script)([>\/\t\n\f\r ])/gi, '<\\/$1$2')
        ret = ret.replace(/\x3c!--/g, '\\x3c!--')
        ret = ret.replace(/--\x3e/g, '--\\x3e')
      }
      return ret
    }

    function _make_name (name: string) {
      name = name.toString()
      name = _to_utf8(name, true)
      return name
    }

    function _make_indent (back: number) {
      return ' '.repeat((_options.indent_start as number) + _indentation - back * (_options.indent_level as number))
    }

    /* -----[ beautification/minification ]----- */

    var _has_parens = false
    var _might_need_space = false
    var _might_need_semicolon = false
    var _might_add_newline = 0
    var _need_newline_indented = false
    var _need_space = false
    var _newline_insert = -1
    var _last = ''
    var _mapping_token: false | string
    var _mapping_name: string
    var _mappings: any[] = _options.source_map && []

    var _do_add_mapping = _mappings ? function () {
      _mappings.forEach(function (mapping) {
        try {
          _options.source_map.add(
            mapping.token.file,
            mapping.line, mapping.col,
            mapping.token.line, mapping.token.col,
            !mapping.name && mapping.token.type == 'name' ? mapping.token.value : mapping.name
          )
        } catch (ex) {
          mapping.token.file != null && AST_Node.warn?.("Couldn't figure out mapping for {file}:{line},{col} → {cline},{ccol} [{name}]", {
            file: mapping.token.file,
            line: mapping.token.line,
            col: mapping.token.col,
            cline: mapping.line,
            ccol: mapping.col,
            name: mapping.name || ''
          })
        }
      })
      _mappings = []
    } : noop

    var _ensure_line_len = _options.max_line_len ? function () {
      if (_current_col > (_options.max_line_len as number)) {
        if (_might_add_newline) {
          var left = _OUTPUT.slice(0, _might_add_newline)
          var right = _OUTPUT.slice(_might_add_newline)
          if (_mappings) {
            var delta = right.length - _current_col
            _mappings.forEach(function (mapping) {
              mapping.line++
              mapping.col += delta
            })
          }
          _OUTPUT = left + '\n' + right
          _current_line++
          _current_pos++
          _current_col = right.length
        }
        if (_current_col > (_options.max_line_len as number)) {
                AST_Node.warn?.('Output exceeds {max_line_len} characters', _options)
        }
      }
      if (_might_add_newline) {
        _might_add_newline = 0
        _do_add_mapping()
      }
    } : noop

    function _print (str: string) {
      str = String(str)
      var ch = get_full_char(str, 0)
      if (_need_newline_indented && ch) {
        _need_newline_indented = false
        if (ch !== '\n') {
          _print('\n')
          _indent()
        }
      }
      if (_need_space && ch) {
        _need_space = false
        if (!/[\s;})]/.test(ch)) {
          _space()
        }
      }
      _newline_insert = -1
      var prev = _last.charAt(_last.length - 1)
      if (_might_need_semicolon) {
        _might_need_semicolon = false

        if (prev === ':' && ch === '}' || (!ch || !';}'.includes(ch)) && prev !== ';') {
          if (_options.semicolons || requireSemicolonChars.has(ch)) {
            _OUTPUT += ';'
            _current_col++
            _current_pos++
          } else {
            _ensure_line_len()
            if (_current_col > 0) {
              _OUTPUT += '\n'
              _current_pos++
              _current_line++
              _current_col = 0
            }

            if (/^\s+$/.test(str)) {
            // reset the semicolon flag, since we didn't print one
            // now and might still have to later
              _might_need_semicolon = true
            }
          }

          if (!_options.beautify) { _might_need_space = false }
        }
      }

      if (_might_need_space) {
        if ((is_identifier_char(prev) &&
                    (is_identifier_char(ch) || ch == '\\')) ||
                (ch == '/' && ch == prev) ||
                ((ch == '+' || ch == '-') && ch == _last)
        ) {
          _OUTPUT += ' '
          _current_col++
          _current_pos++
        }
        _might_need_space = false
      }

      if (_mapping_token) {
        _mappings.push({
          token: _mapping_token,
          name: _mapping_name,
          line: _current_line,
          col: _current_col
        })
        _mapping_token = false
        if (!_might_add_newline) _do_add_mapping()
      }

      _OUTPUT += str
      _has_parens = str[str.length - 1] == '('
      _current_pos += str.length
      var a = str.split(/\r?\n/); var n = a.length - 1
      _current_line += n
      _current_col += a[0].length
      if (n > 0) {
        _ensure_line_len()
        _current_col = a[n].length
      }
      _last = str
    }

    var _star = function () {
      _print('*')
    }

    var _space = _options.beautify ? function () {
      _print(' ')
    } : function () {
      _might_need_space = true
    }

    var _indent = _options.beautify ? function (half?: boolean) {
      if (_options.beautify) {
        _print(_make_indent(half ? 0.5 : 0))
      }
    } : noop

    var _with_indent = _options.beautify ? function (col: boolean | number, cont: Function) {
      if (col === true) col = _next_indent()
      var save_indentation = _indentation
      _indentation = col as number
      var ret = cont()
      _indentation = save_indentation
      return ret
    } : function (_col: boolean | number, cont: Function) { return cont() }

    var _newline = _options.beautify ? function () {
      if (_newline_insert < 0) return _print('\n')
      if (_OUTPUT[_newline_insert] != '\n') {
        _OUTPUT = _OUTPUT.slice(0, _newline_insert) + '\n' + _OUTPUT.slice(_newline_insert)
        _current_pos++
        _current_line++
      }
      _newline_insert++
    } : _options.max_line_len ? function () {
      _ensure_line_len()
      _might_add_newline = _OUTPUT.length
    } : noop

    var _semicolon = _options.beautify ? function () {
      _print(';')
    } : function () {
      _might_need_semicolon = true
    }

    function _force_semicolon () {
      _might_need_semicolon = false
      _print(';')
    }

    function _next_indent () {
      return _indentation + (_options.indent_level as number)
    }

    function _with_block (cont: Function) {
      var ret
      _print('{')
      _newline()
      _with_indent(_next_indent(), function () {
        ret = cont()
      })
      _indent()
      _print('}')
      return ret
    }

    function _with_parens (cont: () => any) {
      _print('(')
      // XXX: still nice to have that for argument lists
      // var ret = with_indent(current_col, cont);
      var ret = cont()
      _print(')')
      return ret
    }

    function _with_square (cont: Function) {
      _print('[')
      // var ret = with_indent(current_col, cont);
      var ret = cont()
      _print(']')
      return ret
    }

    function _comma () {
      _print(',')
      _space()
    }

    function _colon () {
      _print(':')
      _space()
    }

    var _add_mapping = _mappings ? function (token: string, name: string) {
      _mapping_token = token
      _mapping_name = name
    } : noop

    function _get () {
      if (_might_add_newline) {
        _ensure_line_len()
      }
      return _OUTPUT
    }

    function has_nlb () {
      let n = _OUTPUT.length - 1
      while (n >= 0) {
        const code = _OUTPUT.charCodeAt(n)
        if (code === CODE_LINE_BREAK) {
          return true
        }

        if (code !== CODE_SPACE) {
          return false
        }
        n--
      }
      return true
    }

    function filter_comment (comment: string) {
      if (!_options.preserve_annotations) {
        comment = comment.replace(r_annotation, ' ')
      }
      if (/^\s*$/.test(comment)) {
        return ''
      }
      return comment.replace(/(<\s*\/\s*)(script)/i, '<\\/$2')
    }

    function prepend_comments (node: any) {
      var self = this
      var start = node.start
      if (!start) return
      var printed_comments = self.printed_comments

      // There cannot be a newline between return and its value.
      const return_with_value = node?.isAst?.('AST_Exit') && node.value

      if (
        start.comments_before &&
            printed_comments.has(start.comments_before)
      ) {
        if (return_with_value) {
          start.comments_before = []
        } else {
          return
        }
      }

      var comments = start.comments_before
      if (!comments) {
        comments = start.comments_before = []
      }
      printed_comments.add(comments)

      if (return_with_value) {
        var tw = new TreeWalker(function (node: any) {
          var parent: AST_Node = tw.parent()
          if (parent?._prepend_comments_check(node)) {
            if (!node.start) return undefined
            var text = node.start.comments_before
            if (text && !printed_comments.has(text)) {
              printed_comments.add(text)
              comments = comments.concat(text)
            }
          } else {
            return true
          }
          return undefined
        })
        tw.push(node)
        node.value.walk(tw)
      }

      if (_current_pos == 0) {
        if (comments.length > 0 && _options.shebang && comments[0].type === 'comment5' &&
                !printed_comments.has(comments[0])) {
          _print('#!' + comments.shift()?.value + '\n')
          _indent()
        }
        var preamble = _options.preamble
        if (preamble) {
          _print(preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, '\n'))
        }
      }

      comments = comments.filter(_comment_filter, node).filter(c => !printed_comments.has(c))
      if (comments.length == 0) return
      var last_nlb = has_nlb()
      comments.forEach(function (c, i) {
        printed_comments.add(c)
        if (!last_nlb) {
          if (c.nlb) {
            _print('\n')
            _indent()
            last_nlb = true
          } else if (i > 0) {
            _space()
          }
        }

        if (/comment[134]/.test(c.type)) {
          var value = filter_comment(c.value)
          if (value) {
            _print('//' + value + '\n')
            _indent()
          }
          last_nlb = true
        } else if (c.type == 'comment2') {
          var value = filter_comment(c.value)
          if (value) {
            _print('/*' + value + '*/')
          }
          last_nlb = false
        }
      })
      if (!last_nlb) {
        if (start.nlb) {
          _print('\n')
          _indent()
        } else {
          _space()
        }
      }
    }

    function append_comments (node: any, tail?: boolean) {
      var self = this
      var token = node.end
      if (!token) return
      var printed_comments = self.printed_comments
      var comments = token[tail ? 'comments_before' : 'comments_after']
      if (!comments || printed_comments.has(comments)) return
      if (!(node?.isAst?.('AST_Statement') || comments.every((c) =>
        !/comment[134]/.test(c.type)
      ))) return
      printed_comments.add(comments)
      var insert = _OUTPUT.length
      comments.filter(_comment_filter, node).forEach(function (c, i) {
        if (printed_comments.has(c)) return
        printed_comments.add(c)
        _need_space = false
        if (_need_newline_indented) {
          _print('\n')
          _indent()
          _need_newline_indented = false
        } else if (c.nlb && (i > 0 || !has_nlb())) {
          _print('\n')
          _indent()
        } else if (i > 0 || !tail) {
          _space()
        }
        if (/comment[134]/.test(c.type)) {
          const value = filter_comment(c.value)
          if (value) {
            _print('//' + value)
          }
          _need_newline_indented = true
        } else if (c.type == 'comment2') {
          const value = filter_comment(c.value)
          if (value) {
            _print('/*' + value + '*/')
          }
          _need_space = true
        }
      })
      if (_OUTPUT.length > insert) _newline_insert = insert
    }

    var _stack: any[] = []
    this.get = _get
    this.toString = _get
    this.indent = _indent
    this.in_directive = false
    this.use_asm = null
    this.active_scope = null
    this.indentation = function () { return _indentation }
    this.current_width = function () { return _current_col - _indentation }
    this.should_break = function () { return !!(_options.width && this.current_width() >= _options.width) }
    this.has_parens = function () { return _has_parens }
    this.newline = _newline
    this.print = _print
    this.star = _star
    this.space = _space
    this.comma = _comma
    this.colon = _colon
    this.last = function () { return _last }
    this.semicolon = _semicolon
    this.force_semicolon = _force_semicolon
    this.to_utf8 = _to_utf8
    this.print_name = function (name: string) { _print(_make_name(name)) }
    this.print_string = function (str: string, quote: string, escape_directive: boolean) {
      var encoded = _encode_string(str, quote)
      if (escape_directive && !encoded.includes('\\')) {
      // Insert semicolons to break directive prologue
        if (!EXPECT_DIRECTIVE.test(_OUTPUT)) {
          _force_semicolon()
        }
        _force_semicolon()
      }
      _print(encoded)
    }
    this.print_template_string_chars = function (str: string) {
      var encoded = _encode_string(str, '`').replace(/\${/g, '\\${')
      return _print(encoded.substr(1, encoded.length - 2))
    }
    this.encode_string = _encode_string
    this.next_indent = _next_indent
    this.with_indent = _with_indent
    this.with_block = _with_block
    this.with_parens = _with_parens
    this.with_square = _with_square
    this.add_mapping = _add_mapping
    this.option = function (opt: keyof any) { return _options[opt] }
    this.printed_comments = _printed_comments
    this.prepend_comments = _readonly ? noop : prepend_comments
    this.append_comments = _readonly || _comment_filter === return_false ? noop : append_comments
    this.line = function () { return _current_line }
    this.col = function () { return _current_col }
    this.pos = function () { return _current_pos }
    this.push_node = function (node: any) { _stack.push(node) }
    this.pop_node = function () { return _stack.pop() }
    this.parent = function (n?: number) {
      return _stack[_stack.length - 2 - (n || 0)]
    }
  }
}

function factory (opt?: any): any {
  return new OutputStreamInner(opt)
}

export const OutputStream = factory
