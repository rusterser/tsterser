import AST_Statement from './statement'
import TreeWalker from '../tree-walker'
import {
  tighten_body,
  anySideEffect,
  anyMayThrow,
  reset_block_variables,
  return_true,
  walk_body,
  clone_block_scope,
  list_overhead,
  pass_through,
  to_moz,
  do_list
} from '../utils'

export default class AST_Block extends AST_Statement {
  block_scope: any
  expression: any

  _optimize (self, compressor) {
    tighten_body(self.body, compressor)
    return self
  }

  may_throw (compressor: any) {
    return anyMayThrow(this.body, compressor)
  }

  has_side_effects (compressor: any) {
    return anySideEffect(this.body, compressor)
  }

  reduce_vars (tw: TreeWalker, descend, compressor: any) {
    reset_block_variables(compressor, this)
  }

  is_block_scope = return_true
  _walk (visitor: any) {
    return visitor._visit(this, function () {
      walk_body(this, visitor)
    })
  }

  _children_backwards (push: Function) {
    let i = this.body.length
    while (i--) push(this.body[i])
  }

  clone = clone_block_scope
  _size () {
    return 2 + list_overhead(this.body)
  }

  shallow_cmp = pass_through
  _transform (self, tw: any) {
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

  TYPE = 'Block'
  static PROPS = AST_Statement.PROPS.concat(['body', 'block_scope'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.body = args.body
    this.block_scope = args.block_scope
  }
}