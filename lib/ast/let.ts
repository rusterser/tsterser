import AST_Node from './node'
import { OutputStream } from '../output'
import AST_Definitions from './definitions'
import { def_size, to_moz } from '../utils'

export default class AST_Let extends AST_Definitions {
  _to_mozilla_ast (parent: AST_Node) {
    return {
      type: 'VariableDeclaration',
      kind: 'let',
      declarations: this.definitions.map(to_moz)
    }
  }

  _size (): number {
    return def_size(4, this)
  }

  _codegen (output: OutputStream) {
    this._do_print(output, 'let')
  }

  static documentation = 'A `let` statement'

  static PROPS = AST_Definitions.PROPS
}
