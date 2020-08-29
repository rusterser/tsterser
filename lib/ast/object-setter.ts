import AST_Node from './node'
import { OutputStream } from '../output'
import AST_ObjectProperty from './object-property'
import Compressor from '../compressor'
import { to_moz, key_size, static_size, is_ast_node, is_ast_symbol_method, is_ast_symbol, is_ast_symbol_ref, is_ast_class } from '../utils'

export default class AST_ObjectSetter extends AST_ObjectProperty {
  quote: any
  static: any

  _to_mozilla_ast (parent: AST_Node) {
    let key: any = is_ast_node(this.key) ? to_moz(this.key) : {
      type: 'Identifier',
      value: this.key
    }
    if (typeof this.key === 'number') {
      key = {
        type: 'Literal',
        value: Number(this.key)
      }
    }
    if (typeof this.key === 'string') {
      key = {
        type: 'Identifier',
        name: this.key
      }
    }
    const string_or_num = typeof this.key === 'string' || typeof this.key === 'number'
    const computed = string_or_num ? false : !(is_ast_symbol(this.key)) || is_ast_symbol_ref(this.key)
    const kind = 'set'
    if (is_ast_class(parent)) {
      return {
        type: 'MethodDefinition',
        computed: computed,
        kind: kind,
        static: (this as any).static,
        key: to_moz(this.key),
        value: to_moz(this.value)
      }
    }
    return {
      type: 'Property',
      computed: computed,
      kind: kind,
      key: key,
      value: to_moz(this.value)
    }
  }

  drop_side_effect_free () {
    return this.computed_key() ? this.key : null
  }

  may_throw (compressor: Compressor) {
    return this.computed_key() && this.key.may_throw(compressor)
  }

  has_side_effects (compressor: Compressor) {
    return this.computed_key() && this.key.has_side_effects(compressor)
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

  _codegen (self: AST_ObjectSetter, output: OutputStream) {
    self._print_getter_setter('set', output)
  }

  add_source_map (output: OutputStream) { output.add_mapping(this.start, this.key.name) }
  static propdoc = {
    quote: '[string|undefined] the original quote character, if any',
    static: '[boolean] whether this is a static setter (classes only)'
  }

  static documentation = 'An object setter property'

  static PROPS = AST_ObjectProperty.PROPS.concat(['quote', 'static'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.quote = args.quote
    this.static = args.static
  }
}
