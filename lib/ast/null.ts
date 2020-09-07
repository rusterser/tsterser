import AST_Node from './node'
import AST_Atom, { AST_Atom_Props } from './atom'
import { To_Moz_Literal } from '../utils'

export default class AST_Null extends AST_Atom {
  _dot_throw () { return true }
  value: any = null
  _size = () => 4
  _to_mozilla_ast (parent: AST_Node): any {
    return To_Moz_Literal(this)
  }

  static documentation: 'The `null` atom'

  static PROPS = AST_Atom.PROPS
}

export interface AST_Null_Props extends AST_Atom_Props {
}
