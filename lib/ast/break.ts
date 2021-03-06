import AST_Node from './node'
import { OutputStream } from '../output'
import AST_LoopControl, { AST_LoopControl_Props } from './loop-control'
import { to_moz } from '../utils'

export default class AST_Break extends AST_LoopControl {
  public _size () {
    return this.label ? 6 : 5
  }

  public _to_mozilla_ast (_parent: AST_Node): any {
    return {
      type: 'BreakStatement',
      label: this.label ? to_moz(this.label) : null
    }
  }

  protected _codegen (output: OutputStream) {
    this._do_print(output, 'break')
  }

  public static documentation = 'A `break` statement'

  public static PROPS =AST_LoopControl.PROPS
}

export interface AST_Break_Props extends AST_LoopControl_Props {
}
