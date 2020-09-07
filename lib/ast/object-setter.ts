import AST_Node from './node'
import { OutputStream } from '../output'
import AST_ObjectProperty, { AST_ObjectProperty_Props } from './object-property'
import Compressor from '../compressor'
import { key_size, static_size, is_ast_symbol_method } from '../utils'

export default class AST_ObjectSetter extends AST_ObjectProperty {
  quote: string|undefined
  static: boolean

  _to_mozilla_ast_kind (): string | undefined {
    return 'set'
  }

  drop_side_effect_free (): AST_Node | null {
    return this.computed_key() ? this.key as any : null
  }

  may_throw (compressor: Compressor) {
    return this.computed_key() && (this.key as any).may_throw(compressor)
  }

  has_side_effects (compressor: Compressor) {
    return this.computed_key() && (this.key as any).has_side_effects(compressor)
  }

  computed_key () {
    return !(is_ast_symbol_method(this.key))
  }

  _size (): number {
    return 5 + static_size(this.static) + key_size(this.key)
  }

  shallow_cmp_props: any = {
    static: 'eq'
  }

  _codegen (output: OutputStream) {
    this._print_getter_setter('set', output)
  }

  add_source_map (output: OutputStream) { output.add_mapping(this.start, (this.key as any).name) }
  static propdoc = {
    quote: '[string|undefined] the original quote character, if any',
    static: '[boolean] whether this is a static setter (classes only)'
  }

  static documentation = 'An object setter property'

  static PROPS = AST_ObjectProperty.PROPS.concat(['quote', 'static'])
  constructor (args: AST_ObjectSetter_Props) {
    super(args)
    this.quote = args.quote
    this.static = args.static
  }
}

export interface AST_ObjectSetter_Props extends AST_ObjectProperty_Props {
  quote?: string|undefined | undefined
  static?: boolean | undefined
}
