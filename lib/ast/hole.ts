import AST_Node from './node'
import AST_Atom from './atom'
import { noop } from '../utils'
export default class AST_Hole extends AST_Atom {
  to_fun_args (to_fun_args, insert_default, croak, default_seen_above?: AST_Node): any {
    return this
  }

  value = (function () {}())

  to_mozilla_ast = function To_Moz_ArrayHole () { return null }

  _size = () => 0 // comma is taken into account

  _codegen = noop
  static documentation = 'A hole in an array'

  static PROPS = AST_Atom.PROPS
}
