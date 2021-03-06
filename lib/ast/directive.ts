import AST_Node from './node'
import Compressor from '../compressor'
import { OutputStream } from '../output'
import AST_Statement, { AST_Statement_Props } from './statement'
import { directives } from '../constants'
import { make_node } from '../utils'
import { MozillaAst } from '../types'

export default class AST_Directive extends AST_Statement {
  public value: any
  public quote: any
  protected _optimize (compressor: Compressor): any {
    if (compressor.option('directives') &&
          (!directives.has(this.value) || compressor.has_directive(this.value) !== this)) {
      return make_node('AST_EmptyStatement', this)
    }
    return this
  }

  public shallow_cmp_props: any = { value: 'eq' }
  public _size (): number {
    // TODO string encoding stuff
    return 2 + this.value.length
  }

  public _to_mozilla_ast (_parent: AST_Node): MozillaAst {
    return {
      type: 'ExpressionStatement',
      expression: {
        type: 'Literal',
        value: this.value,
        raw: this.print_to_string()
      },
      directive: this.value
    } as any
  }

  protected _codegen (output: OutputStream) {
    output.print_string(this.value, this.quote)
    output.semicolon()
  }

  protected add_source_map (output: OutputStream) { output.add_mapping(this.start) }
  public static documentation = 'Represents a directive, like "use strict";'
  public static propdoc ={
    value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
    quote: '[string] the original quote character'
  } as any

  public static PROPS =AST_Statement.PROPS.concat(['value', 'quote'])
  public constructor (args: AST_Directive_Props) {
    super(args)
    this.value = args.value
    this.quote = args.quote
  }
}

export interface AST_Directive_Props extends AST_Statement_Props {
  value?: any | undefined
  quote?: any | undefined
}
