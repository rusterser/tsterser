import AST_Statement from './statement'
import Compressor from '../compressor'
import TreeWalker from '../tree-walker'
import {
  tighten_body,
  anySideEffect,
  anyMayThrow,
  reset_block_variables,
  walk_body,
  clone_block_scope,
  list_overhead,
  to_moz,
  do_list
} from '../utils'

export default class AST_Block extends AST_Statement {
  block_scope: any
  expression: any

  _optimize (compressor: Compressor) {
    tighten_body(this.body, compressor)
    return this
  }

  may_throw (compressor: Compressor) {
    return anyMayThrow(this.body, compressor)
  }

  has_side_effects (compressor: Compressor) {
    return anySideEffect(this.body, compressor)
  }

  reduce_vars (tw: TreeWalker, descend, compressor: Compressor) {
    reset_block_variables(compressor, this)
  }

  is_block_scope () { return true }
  _walk (visitor: TreeWalker) {
    return visitor._visit(this, function (this) {
      walk_body(this, visitor)
    })
  }

  _children_backwards (push: Function) {
    let i = this.body.length
    while (i--) push(this.body[i])
  }

  clone (deep?: boolean) {
    return clone_block_scope.call(this, deep)
  }

  _size (info: any) {
    return 2 + list_overhead(this.body)
  }

  shallow_cmp = (other) => true
  _transform (self: AST_Block, tw: TreeWalker) {
    self.body = do_list(self.body, tw)
  }

  _to_mozilla_ast (parent): any {
    return {
      type: 'BlockStatement',
      body: this.body.map(to_moz)
    }
  }

  static documentation = 'A body of statements (usually braced)'
  static propdoc = {
    body: '[AST_Statement*] an array of statements',
    block_scope: '[AST_Scope] the block scope'
  } as any

  static PROPS = AST_Statement.PROPS.concat(['body', 'block_scope'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.body = args.body
    this.block_scope = args.block_scope
  }
}
