import { OutputStream } from '../output'
import AST_Statement from './statement'
import { pass_through } from '../utils'

export default class AST_EmptyStatement extends AST_Statement {
  may_throw () { return false }
  has_side_effects () { return false }
  shallow_cmp = pass_through
  _to_mozilla_ast (): any {
    return { type: 'EmptyStatement' }
  }

  _size = () => 1
  _codegen (_self, output: OutputStream) {
    output.semicolon()
  }

  static documentation = 'The empty statement (empty block or simply a semicolon)'

  static PROPS = AST_Statement.PROPS
  constructor (args?) { // eslint-disable-line
    super(args)
  }
}
