import AST_Node from './node'
import { OutputStream } from '../output'
import AST_Block, { AST_Block_Props } from './block'
import { to_moz } from '../utils'
import { MozillaAst } from '../types'

export default class AST_SwitchBranch extends AST_Block {
  public aborts = this._block_aborts
  public is_block_scope (): boolean { return false }
  public shallow_cmp_props: any = {}
  public _to_mozilla_ast (_parent: AST_Node): MozillaAst {
    return {
      type: 'SwitchCase',
      test: to_moz(this.expression),
      consequent: this.body.map(to_moz)
    }
  }

  protected _do_print_body (output: OutputStream) {
    output.newline()
    this.body.forEach(function (stmt) {
      output.indent()
      stmt.print(output)
      output.newline()
    })
  }

  protected add_source_map (output: OutputStream) { output.add_mapping(this.start) }
  public static documentation = 'Base class for `switch` branches'

  public static PROPS =AST_Block.PROPS
}

export interface AST_SwitchBranch_Props extends AST_Block_Props {
}
