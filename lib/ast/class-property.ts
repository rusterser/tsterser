import AST_ObjectProperty from './object-property'
import Compressor from '../compressor'
import { to_moz, print_property_name, static_size, mkshallow, make_sequence } from '../utils'

export default class AST_ClassProperty extends AST_ObjectProperty {
  quote: any
  static: any

  _to_mozilla_ast (parent) {
    var key = this.key?.isAst?.('AST_Node') ? to_moz(this.key) : {
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
    var string_or_num = typeof this.key === 'string' || typeof this.key === 'number'
    var computed = string_or_num ? false : !(this.key?.isAst?.('AST_Symbol')) || this.key?.isAst?.('AST_SymbolRef')
    return {
      type: 'FieldDefinition',
      computed,
      key,
      value: to_moz(this.value),
      static: this.static
    }
  }

  drop_side_effect_free = function (compressor: Compressor) {
    const key = this.computed_key() && this.key.drop_side_effect_free(compressor)

    const value = this.static && this.value &&
          this.value.drop_side_effect_free(compressor)

    if (key && value) return make_sequence(this, [key, value])
    return key || value || null
  }

  may_throw = function (compressor: Compressor) {
    return (
      this.computed_key() && this.key.may_throw(compressor) ||
          this.static && this.value && this.value.may_throw(compressor)
    )
  }

  has_side_effects = function (compressor: Compressor) {
    return (
      this.computed_key() && this.key.has_side_effects(compressor) ||
          this.static && this.value && this.value.has_side_effects(compressor)
    )
  }

  _walk = function (visitor: any) {
    return visitor._visit(this, function () {
      if (this.key?.isAst?.('AST_Node')) { this.key._walk(visitor) }
      if (this.value?.isAst?.('AST_Node')) { this.value._walk(visitor) }
    })
  }

  _children_backwards (push: Function) {
    if (this.value?.isAst?.('AST_Node')) push(this.value)
    if (this.key?.isAst?.('AST_Node')) push(this.key)
  }

  computed_key () {
    return !(this.key?.isAst?.('AST_SymbolClassProperty'))
  }

  _size = function (): number {
    return (
      static_size(this.static) +
            (typeof this.key === 'string' ? this.key.length + 2 : 0) +
            (this.value ? 1 : 0)
    )
  }

  shallow_cmp = mkshallow({
    static: 'eq'
  })

  _codegen = (self, output) => {
    if (self.static) {
      output.print('static')
      output.space()
    }

    if (self.key?.isAst?.('AST_SymbolClassProperty')) {
      print_property_name(self.key.name, self.quote, output)
    } else {
      output.print('[')
      self.key.print(output)
      output.print(']')
    }

    if (self.value) {
      output.print('=')
      self.value.print(output)
    }

    output.semicolon()
  }

  static documentation = 'A class property'
  static propdoc = {
    static: '[boolean] whether this is a static key',
    quote: '[string] which quote is being used'
  }

  static PROPS = AST_ObjectProperty.PROPS.concat(['static', 'quote'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.static = args.static
    this.quote = args.quote
  }
}
