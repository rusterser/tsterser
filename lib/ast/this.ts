import { OutputStream } from '../output'
import AST_Symbol, { AST_Symbol_Props } from './symbol'
import Compressor from '../compressor'

export default class AST_This extends AST_Symbol {
  drop_side_effect_free () { return null }
  may_throw (compressor: Compressor) { return false }
  has_side_effects (compressor: Compressor) { return false }
  _size = () => 4
  shallow_cmp_props: any = {}
  _to_mozilla_ast (): any {
    return { type: 'ThisExpression' }
  }

  _codegen (output: OutputStream) {
    output.print('this')
  }

  static documentation = 'The `this` symbol'

  static PROPS = AST_Symbol.PROPS
}

export interface AST_This_Props extends AST_Symbol_Props {
}
