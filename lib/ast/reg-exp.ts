import AST_Node from './node'
import Compressor from '../compressor'
import { OutputStream } from '../output'
import AST_Constant from './constant'
import { regexp_source_fix, sort_regexp_flags, literals_in_boolean_context } from '../utils'

const r_slash_script = /(<\s*\/\s*script)/i
const slash_script_replace = (_: any, $1: string) => $1.replace('/', '\\/')

export default class AST_RegExp extends AST_Constant {
  value: any
  _optimize (compressor: Compressor) {
    return literals_in_boolean_context(this, compressor)
  }

  _eval (compressor: Compressor) {
    let evaluated = compressor.evaluated_regexps.get(this)
    if (evaluated === undefined) {
      try {
        evaluated = eval(this.print_to_string()) // eslint-disable-line no-eval
      } catch (e) {
        evaluated = null
      }
      compressor.evaluated_regexps.set(this, evaluated)
    }
    return evaluated || this
  }

  _size (): number {
    return this.value.toString().length
  }

  shallow_cmp (other) {
    return (
      this.value.flags === other.value.flags &&
                this.value.source === other.value.source
    )
  }

  _to_mozilla_ast (parent: AST_Node) {
    const pattern = this.value.source
    const flags = this.value.flags
    return {
      type: 'Literal',
      value: null,
      raw: this.print_to_string(),
      regex: { pattern, flags }
    }
  }

  _codegen (self: AST_RegExp, output: OutputStream) {
    let { source, flags } = self.getValue()
    source = regexp_source_fix(source)
    flags = flags ? sort_regexp_flags(flags) : ''
    source = source.replace(r_slash_script, slash_script_replace)
            output.print?.(output.to_utf8(`/${source}/${flags}`))
            const parent = output.parent()
            if (parent?._codegen_should_output_space?.(self)) {
              output.print(' ')
            }
  }

  static documentation = 'A regexp literal'
  static propdoc = {
    value: '[RegExp] the actual regexp'
  }

  static PROPS = AST_Constant.PROPS.concat(['value'])

  constructor (args) {
    super(args)
    this.value = args.value
  }
}
