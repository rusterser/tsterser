import AST_Node from './node'
import Compressor from '../compressor'
import { OutputStream } from '../output'
import AST_Call, { AST_Call_Props } from './call'
import { is_undeclared_ref, list_overhead, to_moz, make_node, is_ast_prop_access, is_ast_call } from '../utils'

export default class AST_New extends AST_Call {
  protected _optimize (compressor: Compressor): any {
    if (
      compressor.option('unsafe') &&
          is_undeclared_ref(this.expression) &&
          ['Object', 'RegExp', 'Function', 'Error', 'Array'].includes(this.expression.name)
    ) return make_node('AST_Call', this, this).transform(compressor)
    return this
  }

  public _eval () { return this }
  public _size (): number {
    return 6 + list_overhead(this.args)
  }

  public _to_mozilla_ast (_parent: AST_Node): any {
    return {
      type: 'NewExpression',
      callee: to_moz(this.expression),
      arguments: this.args.map(to_moz)
    }
  }

  protected needs_parens (output: OutputStream): boolean {
    const p = output.parent()
    if (this.args.length === 0 && (is_ast_prop_access(p) || // (new Date).getTime(), (new Date)["getTime"]()
        (is_ast_call(p) && p.expression === this))) { // (new foo)(bar)
      return true
    }
    return false
  }

  protected _codegen (output: OutputStream) {
    output.print('new')
    output.space()
    this.callCodeGen(output)
  }

  protected add_source_map (output: OutputStream) { output.add_mapping(this.start) }
  public static documentation = 'An object instantiation.  Derives from a function call since it has exactly the same properties'

  public static PROPS =AST_Call.PROPS
}

export interface AST_New_Props extends AST_Call_Props {
}
