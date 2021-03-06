import AST_Node from './node'
import Compressor from '../compressor'
import AST_Atom, { AST_Atom_Props } from './atom'
import { make_node, To_Moz_Literal, is_ast_binary } from '../utils'

export default class AST_Boolean extends AST_Atom {
  protected _optimize (compressor: Compressor): any {
    if (compressor.in_boolean_context()) {
      return make_node('AST_Number', this, {
        value: +this.value
      })
    }
    const p = compressor.parent()
    if (compressor.option('booleans_as_integers')) {
      if (is_ast_binary(p) && (p.operator == '===' || p.operator == '!==')) {
        p.operator = p.operator.replace(/=$/, '')
      }
      return make_node('AST_Number', this, {
        value: +this.value
      })
    }
    if (compressor.option('booleans')) {
      if (is_ast_binary(p) && (p.operator == '==' ||
                                          p.operator == '!=')) {
        compressor.warn('Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]', {
          operator: p.operator,
          value: this.value,
          file: p.start.file,
          line: p.start.line,
          col: p.start.col
        })
        return make_node('AST_Number', this, {
          value: +this.value
        })
      }
      return make_node('AST_UnaryPrefix', this, {
        operator: '!',
        expression: make_node('AST_Number', this, {
          value: 1 - this.value
        })
      })
    }
    return this
  }

  public _to_mozilla_ast (_parent: AST_Node): any {
    return To_Moz_Literal(this)
  }

  public static documentation = 'Base class for booleans'

  public static PROPS =AST_Atom.PROPS
}

export interface AST_Boolean_Props extends AST_Atom_Props {
}
