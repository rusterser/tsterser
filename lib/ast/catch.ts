import AST_DefaultAssign from './default-assign'
import AST_Expansion from './expansion'
import AST_Destructuring from './destructuring'
import AST_SymbolCatch from './symbol-catch'
import AST_Node from './node'
import { OutputStream } from '../output'
import AST_Block, { AST_Block_Props } from './block'
import { list_overhead, do_list, to_moz, to_moz_block } from '../utils'
import TreeTransformer from '../tree-transformer'
import { MozillaAst } from '../types'

export default class AST_Catch extends AST_Block {
  public argname?: AST_SymbolCatch|AST_Destructuring|AST_Expansion|AST_DefaultAssign

  protected walkInner () {
    const result: AST_Node[] = []
    if (this.argname) result.push(this.argname)
    result.push(...this.body)
    return result
  }

  public _children_backwards (push: Function) {
    let i = this.body.length
    while (i--) push(this.body[i])
    if (this.argname) push(this.argname)
  }

  public _size (): number {
    let size = 7 + list_overhead(this.body)
    if (this.argname) {
      size += 2
    }
    return size
  }

  public shallow_cmp_props: any = {
    argname: 'exist'
  }

  protected _transform (tw: TreeTransformer) {
    if (this.argname) this.argname = this.argname.transform(tw)
    this.body = do_list(this.body, tw)
  }

  public _to_mozilla_ast (_parent: AST_Node): MozillaAst {
    return {
      type: 'CatchClause',
      param: this.argname ? to_moz(this.argname) : null,
      guard: null,
      body: to_moz_block(this)
    } as any
  }

  protected _codegen (output: OutputStream) {
    output.print('catch')
    if (this.argname) {
      output.space()
      output.with_parens(() => {
        this.argname?.print(output)
      })
    }
    output.space()
    this.print_braced(output)
  }

  protected add_source_map (output: OutputStream) { output.add_mapping(this.start) }
  public static documentation = 'A `catch` node; only makes sense as part of a `try` statement'
  public static propdoc ={
    argname: '[AST_SymbolCatch|AST_Destructuring|AST_Expansion|AST_DefaultAssign] symbol for the exception'
  }

  public static PROPS =AST_Block.PROPS.concat(['argname'])
  public constructor (args: AST_Catch_Props) {
    super(args)
    this.argname = args.argname
  }
}

export interface AST_Catch_Props extends AST_Block_Props {
  argname?: AST_SymbolCatch|AST_Destructuring|AST_Expansion|AST_DefaultAssign | undefined
}
