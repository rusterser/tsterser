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

import { defaults, makePredicate, is_ast_statement, is_ast_exit, get_full_char_code, get_full_char, is_identifier_char } from './utils'
import AST_Node from './ast/node'
import TreeWalker from './tree-walker'
import AST_Token from './ast/token'
import AST_Scope from './ast/scope'
import { Comment, OutputOptions } from './types'

const EXPECT_DIRECTIVE = /^$|[;{][\s\n]*$/
const CODE_LINE_BREAK = 10
const CODE_SPACE = 32

const r_annotation = /[@#]__(PURE|INLINE|NOINLINE)__/g
const requireSemicolonChars = makePredicate('( [ + * / - , . `')

function is_some_comments (comment: Comment) {
  // multiline comment
  return (
    (comment.type === 'comment2' || comment.type === 'comment1') &&
        /@preserve|@lic|@cc_on|^\**!/i.test(comment.value)
  )
}

const quote_single = (str: string) => {
  return "'" + str.replace(/\x27/g, "\\'") + "'"
}
const quote_double = (str: string) => {
  return '"' + str.replace(/\x22/g, '\\"') + '"'
}
const quote_template = (str: string) => {
  return '`' + str.replace(/`/g, '\\`') + '`'
}

export class OutputStream {
  public options: OutputOptions

  public in_directive = false
  public use_asm: AST_Scope | null = null
  public active_scope: AST_Scope | null = null
  private _has_parens = false
  private _might_need_space = false
  private _might_need_semicolon = false
  private _might_add_newline = 0
  private _need_newline_indented = false
  private _need_space = false
  private _newline_insert = -1
  private _last = ''
  private _mapping_token: AST_Token | false = false
  private _mapping_name: string | undefined
  private _indentation = 0
  private _current_col = 0
  private _current_line = 1
  private _current_pos = 0
  private _OUTPUT = ''
  public readonly printed_comments: Set<Comment[] | Comment> = new Set()

  public with_parens (cont: () => any) {
    this.print('(')
    // XXX: still nice to have that for argument lists
    // var ret = with_indent(current_col, cont);
    const ret = cont()
    this.print(')')
    return ret
  }

  private _make_indent (back: number) {
    return ' '.repeat((this.options.indent_start as number) + this._indentation - (back * (this.options.indent_level as number)))
  }

  public semicolon () {
    if (this.options.beautify) {
      this.print(';')
    } else {
      this._might_need_semicolon = true
    }
  }

  public indent (half: boolean = false) {
    if (this.options.beautify) {
      this.print(this._make_indent(half ? 0.5 : 0))
    }
  }

  public space () {
    if (this.options.beautify) {
      this.print(' ')
    } else {
      this._might_need_space = true
    }
  }

  public _mappings: any[] | null = null

  private _ensure_line_len () {
    if (this.options.max_line_len) {
      if (this._current_col > this.options.max_line_len) {
        if (this._might_add_newline) {
          const left = this._OUTPUT.slice(0, this._might_add_newline)
          const right = this._OUTPUT.slice(this._might_add_newline)
          if (this._mappings) {
            const delta = right.length - this._current_col
            this._mappings.forEach((mapping) => {
              mapping.line++
              mapping.col += delta
            })
          }
          this._OUTPUT = left + '\n' + right
          this._current_line++
          this._current_pos++
          this._current_col = right.length
        }
        if (this._current_col > this.options.max_line_len) {
          AST_Node.warn?.('Output exceeds {max_line_len} characters', this.options)
        }
      }
      if (this._might_add_newline) {
        this._might_add_newline = 0
        this._do_add_mapping()
      }
    }
  }

  public with_block (cont: Function) {
    let ret
    this.print('{')
    this.newline()
    this.with_indent(this.next_indent(), () => {
      ret = cont()
    })
    this.indent()
    this.print('}')
    return ret
  }

  private _do_add_mapping () {
    if (this._mappings) {
      this._mappings.forEach((mapping) => {
        try {
          this.options.source_map.add(
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
      this._mappings = []
    }
  }

  public to_utf8 (str: string, identifier: boolean = false) {
    if (this.options.ascii_only) {
      if (this.options.ecma as number >= 2015) {
        str = str.replace(/[\ud800-\udbff][\udc00-\udfff]/g, (ch) => {
          const code = get_full_char_code(ch, 0).toString(16)
          return '\\u{' + code + '}'
        })
      }
      return str.replace(/[\u0000-\u001f\u007f-\uffff]/g, (ch) => { // eslint-disable-line no-control-regex
        let code = ch.charCodeAt(0).toString(16)
        if (code.length <= 2 && !identifier) {
          while (code.length < 2) code = '0' + code
          return '\\x' + code
        } else {
          while (code.length < 4) code = '0' + code
          return '\\u' + code
        }
      })
    } else {
      return str.replace(/[\ud800-\udbff][\udc00-\udfff]|([\ud800-\udbff]|[\udc00-\udfff])/g, (match, lone) => {
        if (lone) {
          return '\\u' + lone.charCodeAt(0).toString(16)
        }
        return match
      })
    }
  }

  public append_comments (node: AST_Node, tail: boolean = false) {
    if (!this.readonly && this._comment_filter !== (() => false)) {
      const self = this
      const token = node.end
      if (!token) return
      const printed_comments = self.printed_comments
      const comments = token[tail ? 'comments_before' : 'comments_after']
      if (!comments || printed_comments.has(comments)) return
      if (!(is_ast_statement(node) || comments.every((c) =>
        !/comment[134]/.test(c.type)
      ))) return
      printed_comments.add(comments)
      const insert = this._OUTPUT.length
      comments.filter(this._comment_filter, node).forEach((c, i) => {
        if (printed_comments.has(c)) return
        printed_comments.add(c)
        this._need_space = false
        if (this._need_newline_indented) {
          this.print('\n')
          this.indent()
          this._need_newline_indented = false
        } else if (c.nlb && (i > 0 || !this.has_nlb())) {
          this.print('\n')
          this.indent()
        } else if (i > 0 || !tail) {
          this.space()
        }
        if (/comment[134]/.test(c.type)) {
          const value = this.filter_comment(c.value)
          if (value) {
            this.print('//' + value)
          }
          this._need_newline_indented = true
        } else if (c.type == 'comment2') {
          const value = this.filter_comment(c.value)
          if (value) {
            this.print('/*' + value + '*/')
          }
          this._need_space = true
        }
      })
      if (this._OUTPUT.length > insert) this._newline_insert = insert
    }
  }

  public indentation () { return this._indentation }

  public current_width () { return this._current_col - this._indentation }

  public should_break () { return !!(this.options.width && this.current_width() >= this.options.width) }

  public has_parens () { return this._has_parens }

  public last () { return this._last }

  private _make_name (name: string) {
    name = name.toString()
    name = this.to_utf8(name, true)
    return name
  }

  public print_name (name: string) { this.print(this._make_name(name)) }

  private encode_string (str: string, quote?: string) {
    let ret = this.make_string(str, quote)
    if (this.options.inline_script) {
      ret = ret.replace(/<\x2f(script)([>/\t\n\f\r ])/gi, '<\\/$1$2')
      ret = ret.replace(/\x3c!--/g, '\\x3c!--')
      ret = ret.replace(/--\x3e/g, '--\\x3e')
    }
    return ret
  }

  public force_semicolon () {
    this._might_need_semicolon = false
    this.print(';')
  }

  public print_string (str: string, quote?: string, escape_directive: boolean = false) {
    const encoded = this.encode_string(str, quote)
    if (escape_directive && !encoded.includes('\\')) {
    // Insert semicolons to break directive prologue
      if (!EXPECT_DIRECTIVE.test(this._OUTPUT)) {
        this.force_semicolon()
      }
      this.force_semicolon()
    }
    this.print(encoded)
  }

  public print_template_string_chars (str: string) {
    const encoded = this.encode_string(str, '`').replace(/\${/g, '\\${')
    return this.print(encoded.substr(1, encoded.length - 2))
  }

  private filter_comment (comment: string) {
    if (!this.options.preserve_annotations) {
      comment = comment.replace(r_annotation, ' ')
    }
    if (/^\s*$/.test(comment)) {
      return ''
    }
    return comment.replace(/(<\s*\/\s*)(script)/i, '<\\/$2')
  }

  public newline () {
    if (this.options.beautify) {
      if (this._newline_insert < 0) return this.print('\n')
      if (this._OUTPUT[this._newline_insert] != '\n') {
        this._OUTPUT = this._OUTPUT.slice(0, this._newline_insert) + '\n' + this._OUTPUT.slice(this._newline_insert)
        this._current_pos++
        this._current_line++
      }
      this._newline_insert++
    } else if (this.options.max_line_len) {
      this._ensure_line_len()
      this._might_add_newline = this._OUTPUT.length
    }
  }

  public next_indent () {
    return this._indentation + (this.options.indent_level as number)
  }

  public with_indent (col: boolean | number, cont: Function) {
    if (this.options.beautify) {
      if (col === true) col = this.next_indent()
      const save_indentation = this._indentation
      this._indentation = col as number
      const ret = cont()
      this._indentation = save_indentation
      return ret
    }
    return cont()
  }

  private make_string (str: string, quote?: string) {
    let dq = 0; let sq = 0
    str = str.replace(/[\\\b\f\n\r\v\t\x22\x27\u2028\u2029\0\ufeff]/g,
      (s, i) => {
        switch (s) {
          case '"': ++dq; return '"'
          case "'": ++sq; return "'"
          case '\\': return '\\\\'
          case '\n': return '\\n'
          case '\r': return '\\r'
          case '\t': return '\\t'
          case '\b': return '\\b'
          case '\f': return '\\f'
          case '\x0B': return this.options.ie8 ? '\\x0B' : '\\v'
          case '\u2028': return '\\u2028'
          case '\u2029': return '\\u2029'
          case '\ufeff': return '\\ufeff'
          case '\0':
            return /[0-9]/.test(get_full_char(str, i + 1)) ? '\\x00' : '\\0'
        }
        return s
      })

    str = this.to_utf8(str)
    if (quote === '`') return quote_template(str)
    switch (this.options.quote_style) {
      case 1:
        return quote_single(str)
      case 2:
        return quote_double(str)
      case 3:
        return quote == "'" ? quote_single(str) : quote_double(str)
      default:
        return dq > sq ? quote_single(str) : quote_double(str)
    }
  }

  public print (str: string) {
    str = String(str)
    const ch = get_full_char(str, 0)
    if (this._need_newline_indented && ch) {
      this._need_newline_indented = false
      if (ch !== '\n') {
        this.print('\n')
        this.indent()
      }
    }
    if (this._need_space && ch) {
      this._need_space = false
      if (!/[\s;})]/.test(ch)) {
        this.space()
      }
    }
    this._newline_insert = -1
    const prev = this._last.charAt(this._last.length - 1)
    if (this._might_need_semicolon) {
      this._might_need_semicolon = false

      if ((prev === ':' && ch === '}') || ((!ch || !';}'.includes(ch)) && prev !== ';')) {
        if (this.options.semicolons || requireSemicolonChars.has(ch)) {
          this._OUTPUT += ';'
          this._current_col++
          this._current_pos++
        } else {
          this._ensure_line_len()
          if (this._current_col > 0) {
            this._OUTPUT += '\n'
            this._current_pos++
            this._current_line++
            this._current_col = 0
          }

          if (/^\s+$/.test(str)) {
          // reset the semicolon flag, since we didn't print one
          // now and might still have to later
            this._might_need_semicolon = true
          }
        }

        if (!this.options.beautify) { this._might_need_space = false }
      }
    }

    if (this._might_need_space) {
      if ((is_identifier_char(prev) &&
                  (is_identifier_char(ch) || ch == '\\')) ||
              (ch == '/' && ch == prev) ||
              ((ch == '+' || ch == '-') && ch == this._last)
      ) {
        this._OUTPUT += ' '
        this._current_col++
        this._current_pos++
      }
      this._might_need_space = false
    }

    if (this._mapping_token) {
      this._mappings?.push({
        token: this._mapping_token,
        name: this._mapping_name,
        line: this._current_line,
        col: this._current_col
      })
      this._mapping_token = false
      if (!this._might_add_newline) this._do_add_mapping()
    }

    this._OUTPUT += str
    this._has_parens = str[str.length - 1] == '('
    this._current_pos += str.length
    const a = str.split(/\r?\n/); const n = a.length - 1
    this._current_line += n
    this._current_col += a[0].length
    if (n > 0) {
      this._ensure_line_len()
      this._current_col = a[n].length
    }
    this._last = str
  }

  public readonly: boolean
  private _comment_filter (_comment: Comment) { return false } // Default case, throw all comments away

  public colon () {
    this.print(':')
    this.space()
  }

  public comma () {
    this.print(',')
    this.space()
  }

  public option (opt: keyof OutputOptions) { return this.options[opt] }

  public line () { return this._current_line }

  public col () { return this._current_col }

  public pos () { return this._current_pos }

  private readonly stack: any[] = []

  public push_node (node: AST_Node) { this.stack.push(node) }

  public pop_node () { return this.stack.pop() }

  public parent (n?: number) {
    return this.stack[this.stack.length - 2 - (n || 0)]
  }

  public prepend_comments (node: AST_Node) {
    if (!this.readonly) {
      const self = this
      const start = node.start
      if (!start) return
      const printed_comments = self.printed_comments

      // There cannot be a newline between return and its value.
      const return_with_value = is_ast_exit(node) && node.value

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

      let comments = start.comments_before
      if (!comments) {
        comments = start.comments_before = []
      }
      printed_comments.add(comments)

      if (return_with_value) {
        const tw = new TreeWalker((node: AST_Node) => {
          const parent: AST_Node = tw.parent()
          if (parent?._prepend_comments_check(node)) {
            if (!node.start) return undefined
            const text = node.start.comments_before
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

      if (this._current_pos == 0) {
        if (comments.length > 0 && this.options.shebang && comments[0].type === 'comment5' &&
              !printed_comments.has(comments[0])) {
          this.print('#!' + comments.shift()?.value + '\n')
          this.indent()
        }
        const preamble = this.options.preamble
        if (preamble) {
          this.print(preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, '\n'))
        }
      }

      comments = comments.filter(this._comment_filter, node).filter(c => !printed_comments.has(c))
      if (comments.length == 0) return
      let last_nlb = this.has_nlb()
      comments.forEach((c, i) => {
        printed_comments.add(c)
        if (!last_nlb) {
          if (c.nlb) {
            this.print('\n')
            this.indent()
            last_nlb = true
          } else if (i > 0) {
            this.space()
          }
        }

        if (/comment[134]/.test(c.type)) {
          const value = this.filter_comment(c.value)
          if (value) {
            this.print('//' + value + '\n')
            this.indent()
          }
          last_nlb = true
        } else if (c.type == 'comment2') {
          const value = this.filter_comment(c.value)
          if (value) {
            this.print('/*' + value + '*/')
          }
          last_nlb = false
        }
      })
      if (!last_nlb) {
        if (start.nlb) {
          this.print('\n')
          this.indent()
        } else {
          this.space()
        }
      }
    }
  }

  private has_nlb () {
    let n = this._OUTPUT.length - 1
    while (n >= 0) {
      const code = this._OUTPUT.charCodeAt(n)
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

  public with_square (cont: Function) {
    this.print('[')
    // var ret = with_indent(current_col, cont);
    const ret = cont()
    this.print(']')
    return ret
  }

  public add_mapping (token: AST_Token, name?: string) {
    if (this._mappings) {
      this._mapping_token = token
      this._mapping_name = name
    }
  }

  public star () {
    this.print('*')
  }

  private get () {
    if (this._might_add_newline) {
      this._ensure_line_len()
    }
    return this._OUTPUT
  }

  public toString = this.get

  public constructor (opt?: Partial<OutputOptions>) {
    this.readonly = !opt
    const defaultOptions: OutputOptions = {
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
    }
    const _options: OutputOptions = defaults(opt ?? {}, defaultOptions, true)

    this.options = _options
    if (_options.source_map) {
      this._mappings = []
    }

    if (_options.shorthand === undefined) { _options.shorthand = _options.ecma as number > 5 }

    // Convert comment option to RegExp if neccessary and set up comments filter
    if (_options.comments) {
      let comments = _options.comments
      if (typeof _options.comments === 'string' && /^\/.*\/[a-zA-Z]*$/.test(_options.comments)) {
        const regex_pos = _options.comments.lastIndexOf('/')
        comments = new RegExp(
          _options.comments.substr(1, regex_pos - 1),
          _options.comments.substr(regex_pos + 1)
        )
      }
      if (comments instanceof RegExp) {
        this._comment_filter = (comment: Comment) => {
          return comment.type != 'comment5' && (comments as RegExp).test(comment.value)
        }
      } else if (typeof comments === 'function') {
        this._comment_filter = (comment: Comment) => {
          return comment.type != 'comment5' && (comments as Function)(this, comment)
        }
      } else if (comments === 'some') {
        this._comment_filter = is_some_comments
      } else { // NOTE includes "all" option
        this._comment_filter = () => true
      }
    }
  }
}

export default function factory (opt?: any): any {
  return new OutputStream(opt)
}
