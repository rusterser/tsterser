import AST_Scope from './scope'
import AST_SymbolFunarg from './symbol-funarg'

import {
  opt_AST_Lambda,
  return_false,
  To_Moz_FunctionExpression,
  return_this,
  all_refs_local,
  walk,
  mkshallow,
  do_list,
  print_braced,
  walk_body,
  init_scope_vars,
  mark_lambda
} from '../utils'

import {
  walk_abort
} from '../constants'

export default class AST_Lambda extends AST_Scope {
  argnames: any
  uses_arguments: any
  name: any
  is_generator: any
  async: any

  _optimize = opt_AST_Lambda
  may_throw = return_false
  has_side_effects = return_false
  _eval = return_this as any
  is_constant_expression = all_refs_local
  reduce_vars = mark_lambda
  contains_this () {
    return walk(this, (node: any) => {
      if (node?.isAst?.('AST_This')) return walk_abort
      if (
        node !== this &&
              node?.isAst?.('AST_Scope') &&
              !(node?.isAst?.('AST_Arrow'))
      ) {
        return true
      }
    })
  }

  is_block_scope = return_false
  init_scope_vars = function () {
    init_scope_vars.apply(this, arguments)
    this.uses_arguments = false
    this.def_variable(new AST_SymbolFunarg({
      name: 'arguments',
      start: this.start,
      end: this.end
    }))
  }

  args_as_names () {
    var out: any[] = []
    for (var i = 0; i < this.argnames.length; i++) {
      if (this.argnames[i]?.isAst?.('AST_Destructuring')) {
        out.push(...this.argnames[i].all_symbols())
      } else {
        out.push(this.argnames[i])
      }
    }
    return out
  }

  _walk (visitor: any) {
    return visitor._visit(this, function () {
      if (this.name) this.name._walk(visitor)
      var argnames = this.argnames
      for (var i = 0, len = argnames.length; i < len; i++) {
        argnames[i]._walk(visitor)
      }
      walk_body(this, visitor)
    })
  }

  _children_backwards (push: Function) {
    let i = this.body.length
    while (i--) push(this.body[i])

    i = this.argnames.length
    while (i--) push(this.argnames[i])

    if (this.name) push(this.name)
  }

  shallow_cmp = mkshallow({
    is_generator: 'eq',
    async: 'eq'
  })

  _transform (self, tw: any) {
    if (self.name) self.name = self.name.transform(tw)
    self.argnames = do_list(self.argnames, tw)
    if (self.body?.isAst?.('AST_Node')) {
      self.body = (self.body).transform(tw)
    } else {
      self.body = do_list(self.body, tw)
    }
  }

  _to_mozilla_ast (parent) {
    return To_Moz_FunctionExpression(this, parent)
  }

  _do_print (this: any, output: any, nokeyword: boolean) {
    var self = this
    if (!nokeyword) {
      if (self.async) {
        output.print('async')
        output.space()
      }
      output.print('function')
      if (self.is_generator) {
        output.star()
      }
      if (self.name) {
        output.space()
      }
    }
    if (self.name?.isAst?.('AST_Symbol')) {
      self.name.print(output)
    } else if (nokeyword && self.name?.isAst?.('AST_Node')) {
      output.with_square(function () {
                self.name?.print(output) // Computed method name
      })
    }
    output.with_parens(function () {
      self.argnames.forEach(function (arg, i) {
        if (i) output.comma()
        arg.print(output)
      })
    })
    output.space()
    print_braced(self, output, true)
  }

  _codegen (self, output) {
    self._do_print(output)
  }

  add_source_map (output) { output.add_mapping(this.start) }
  static documentation = 'Base class for functions'
  static propdoc = {
    name: '[AST_SymbolDeclaration?] the name of this function',
    argnames: '[AST_SymbolFunarg|AST_Destructuring|AST_Expansion|AST_DefaultAssign*] array of function arguments, destructurings, or expanding arguments',
    uses_arguments: '[boolean/S] tells whether this function accesses the arguments array',
    is_generator: '[boolean] is this a generator method',
    async: '[boolean] is this method async'
  }

  static PROPS = AST_Scope.PROPS.concat(['name', 'argnames', 'uses_arguments', 'is_generator', 'async'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.name = args.name
    this.argnames = args.argnames
    this.uses_arguments = args.uses_arguments
    this.is_generator = args.is_generator
    this.async = args.async
  }
}