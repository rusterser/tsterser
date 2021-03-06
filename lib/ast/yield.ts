import Compressor from '../compressor'
import { OutputStream } from '../output'
import AST_Node, { AST_Node_Props } from './node'
import { is_undefined, to_moz, is_ast_binary, is_ast_call, is_ast_conditional, is_ast_unary } from '../utils'
import TreeTransformer from '../tree-transformer'

export default class AST_Yield extends AST_Node {
  public value: any
  public is_star: boolean
  public expression: AST_Node | null

  protected _optimize (compressor: Compressor): any {
    if (this.expression && !this.is_star && is_undefined(this.expression, compressor)) {
      this.expression = null
    }
    return this
  }

  protected walkInner () {
    return this.expression ? [this.expression] : []
  }

  public _children_backwards (push: Function) {
    if (this.expression) push(this.expression)
  }

  public _size = () => 6
  public shallow_cmp_props: any = {
    is_star: 'eq'
  }

  protected _transform (tw: TreeTransformer) {
    if (this.expression) this.expression = this.expression.transform(tw)
  }

  public _to_mozilla_ast (_parent: AST_Node): any {
    return {
      type: 'YieldExpression',
      argument: this.expression ? to_moz(this.expression) : null,
      delegate: this.is_star
    }
  }

  protected needs_parens (output: OutputStream): boolean {
    const p = output.parent()
    // (yield 1) + (yield 2)
    // a = yield 3
    if (is_ast_binary(p) && p.operator !== '=') { return true }
    // (yield 1)()
    // new (yield 1)()
    if (is_ast_call(p) && p.expression === this) { return true }
    // (yield 1) ? yield 2 : yield 3
    if (is_ast_conditional(p) && p.condition === this) { return true }
    // -(yield 4)
    if (is_ast_unary(p)) { return true }
    // (yield x).foo
    // (yield x)['foo']
    if (p?._needs_parens(this)) { return true }
    return false
  }

  protected _codegen (output: OutputStream) {
    const star = this.is_star ? '*' : ''
    output.print('yield' + star)
    if (this.expression) {
      output.space()
      this.expression.print(output)
    }
  }

  public static documentation = 'A `yield` statement'
  public static propdoc ={
    expression: '[AST_Node?] the value returned or thrown by this statement; could be null (representing undefined) but only when is_star is set to false',
    is_star: '[boolean] Whether this is a yield or yield* statement'
  }

  public static PROPS =AST_Node.PROPS.concat(['expression', 'is_star'])
  public constructor (args: AST_Yield_Props) {
    super(args)
    this.expression = args.expression
    this.is_star = args.is_star ?? false
  }
}

export interface AST_Yield_Props extends AST_Node_Props {
  expression: AST_Node | null
  is_star: boolean | undefined
}
