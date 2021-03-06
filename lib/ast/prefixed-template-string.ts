import AST_PropAccess from './prop-access'
import AST_SymbolRef from './symbol-ref'
import AST_TemplateString from './template-string'
import Compressor from '../compressor'
import { OutputStream } from '../output'
import AST_Node, { AST_Node_Props } from './node'
import { to_moz, is_ast_lambda, is_ast_binary, is_ast_conditional, is_ast_sequence, is_ast_unary, is_ast_dot, is_ast_object } from '../utils'
import TreeTransformer from '../tree-transformer'
import { MozillaAst } from '../types'

export default class AST_PrefixedTemplateString extends AST_Node {
  public template_string: AST_TemplateString
  public prefix: AST_SymbolRef|AST_PropAccess

  protected _optimize (_compressor: Compressor): any {
    return this
  }

  protected walkInner () {
    const result: AST_Node[] = []
    result.push(this.prefix)
    result.push(this.template_string)
    return result
  }

  public _children_backwards (push: Function) {
    push(this.template_string)
    push(this.prefix)
  }

  public shallow_cmp_props: any = {}
  protected _transform (tw: TreeTransformer) {
    this.prefix = this.prefix.transform(tw)
    this.template_string = this.template_string.transform(tw)
  }

  public _to_mozilla_ast (_parent: AST_Node): MozillaAst {
    return {
      type: 'TaggedTemplateExpression',
      tag: to_moz(this.prefix),
      quasi: to_moz(this.template_string)
    }
  }

  protected _codegen (output: OutputStream) {
    const tag = this.prefix
    const parenthesize_tag = is_ast_lambda(tag) ||
            is_ast_binary(tag) ||
            is_ast_conditional(tag) ||
            is_ast_sequence(tag) ||
            is_ast_unary(tag) ||
            (is_ast_dot(tag) && is_ast_object(tag.expression))
    if (parenthesize_tag) output.print('(')
    this.prefix.print(output)
    if (parenthesize_tag) output.print(')')
    this.template_string.print(output)
  }

  public static documentation = 'A templatestring with a prefix, such as String.raw`foobarbaz`'
  public static propdoc ={
    template_string: '[AST_TemplateString] The template string',
    prefix: '[AST_SymbolRef|AST_PropAccess] The prefix, which can be a symbol such as `foo` or a dotted expression such as `String.raw`.'
  }

  public static PROPS =AST_Node.PROPS.concat(['template_string', 'prefix'])
  public constructor (args: AST_PrefixedTemplateString_Props) {
    super(args)
    this.template_string = args.template_string
    this.prefix = args.prefix
  }
}

export interface AST_PrefixedTemplateString_Props extends AST_Node_Props {
  template_string: AST_TemplateString
  prefix: AST_SymbolRef|AST_PropAccess
}
