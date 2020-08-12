import AST_DWLoop from './dw-loop'
import { make_node, reset_block_variables, push, pop, pass_through, to_moz } from '../utils'
import TreeWalker from '../tree-walker'

export default class AST_While extends AST_DWLoop {
  _optimize (self, compressor: any) {
    return compressor.option('loops') ? make_node('AST_For', self, self).optimize(compressor) : self
  }

  reduce_vars (tw: TreeWalker, descend, compressor: any) {
    reset_block_variables(compressor, this)
    const saved_loop = tw.in_loop
    tw.in_loop = this
    push(tw)
    descend()
    pop(tw)
    tw.in_loop = saved_loop
    return true
  }

  _walk (visitor: any) {
    return visitor._visit(this, function () {
      this.condition._walk(visitor)
      this.body._walk(visitor)
    })
  }

  _children_backwards (push: Function) {
    push(this.body)
    push(this.condition)
  }

  _size = () => 7
  shallow_cmp = pass_through
  _transform (self, tw: any) {
    self.condition = self.condition.transform(tw)
    self.body = (self.body).transform(tw)
  }

  _to_mozilla_ast (parent): any {
    return {
      type: 'WhileStatement',
      test: to_moz(this.condition),
      body: to_moz(this.body)
    }
  }

  _codegen (self, output) {
    output.print('while')
    output.space()
    output.with_parens(function () {
      self.condition.print(output)
    })
    output.space()
    self._do_print_body(output)
  }

  static documentation = 'A `while` statement'

  TYPE = 'While'
  static PROPS = AST_DWLoop.PROPS
  constructor (args?) { // eslint-disable-line
    super(args)
  }
}