import AST_Definitions from './definitions'
import AST_Defun from './defun'
import AST_Node from './node'
import { OutputStream } from '../output'
import AST_Statement, { AST_Statement_Props } from './statement'
import { to_moz, do_list, list_overhead, is_ast_definitions, is_ast_defun, is_ast_function, is_ast_class } from '../utils'
import { AST_String, AST_DefClass, AST_NameMapping } from '.'
import TreeTransformer from '../tree-transformer'
import { MozillaAst } from '../types'

export default class AST_Export extends AST_Statement {
  public is_default: boolean
  public module_name: AST_String | undefined
  public exported_value: AST_Node | undefined
  public exported_definition: AST_Defun|AST_Definitions|AST_DefClass | undefined
  public exported_names: AST_NameMapping[]

  protected walkInner () {
    const result: AST_Node[] = []
    if (this.exported_definition) {
      result.push(this.exported_definition)
    }
    if (this.exported_value) {
      result.push(this.exported_value)
    }
    this.exported_names.forEach(function (name_export) {
      result.push(name_export)
    })
    if (this.module_name) {
      result.push(this.module_name)
    }
    return result
  }

  public _children_backwards (push: Function) {
    if (this.module_name) push(this.module_name)
    let i = this.exported_names.length
    while (i--) push(this.exported_names[i])
    if (this.exported_value) push(this.exported_value)
    if (this.exported_definition) push(this.exported_definition)
  }

  public _size (): number {
    let size = 7 + (this.is_default ? 8 : 0)

    if (this.exported_value) {
      size += this.exported_value._size()
    }

    if (this.exported_names.length > 0) {
      // Braces and commas
      size += 2 + list_overhead(this.exported_names)
    }

    if (this.module_name) {
      // "from "
      size += 5
    }

    return size
  }

  public shallow_cmp_props: any = {
    exported_definition: 'exist',
    exported_value: 'exist',
    exported_names: 'exist',
    module_name: 'eq',
    is_default: 'eq'
  }

  protected _transform (tw: TreeTransformer) {
    if (this.exported_definition) this.exported_definition = this.exported_definition.transform(tw)
    if (this.exported_value) this.exported_value = this.exported_value.transform(tw)
    if (this.exported_names.length > 0) do_list(this.exported_names, tw)
    if (this.module_name) this.module_name = this.module_name.transform(tw)
  }

  public _to_mozilla_ast (_parent: AST_Node): MozillaAst {
    if (this.exported_names.length > 0) {
      if (this.exported_names[0].name.name === '*') {
        return {
          type: 'ExportAllDeclaration',
          source: this.module_name ? to_moz(this.module_name) : null
        }
      }
      return {
        type: 'ExportNamedDeclaration',
        specifiers: this.exported_names.map(function (name_mapping) {
          return {
            type: 'ExportSpecifier',
            exported: to_moz(name_mapping.foreign_name),
            local: to_moz(name_mapping.name)
          }
        }),
        declaration: this.exported_definition ? to_moz(this.exported_definition) : null,
        source: this.module_name ? to_moz(this.module_name) : null
      }
    }
    const decl = this.exported_value ?? this.exported_definition
    return {
      type: this.is_default ? 'ExportDefaultDeclaration' : 'ExportNamedDeclaration',
      declaration: decl ? to_moz(decl) : null
    }
  }

  protected _codegen (output: OutputStream) {
    output.print('export')
    output.space()
    if (this.is_default) {
      output.print('default')
      output.space()
    }
    if (this.exported_names.length > 0) {
      if (this.exported_names.length === 1 && this.exported_names[0].name.name === '*') {
        this.exported_names[0].print(output)
      } else {
        output.print('{')
        this.exported_names.forEach((name_export, i) => {
          output.space()
          name_export.print(output)
          if (i < this.exported_names.length - 1) {
            output.print(',')
          }
        })
        output.space()
        output.print('}')
      }
    } else if (this.exported_value) {
      this.exported_value.print(output)
    } else if (this.exported_definition) {
      this.exported_definition.print(output)
      if (is_ast_definitions(this.exported_definition)) return
    }
    if (this.module_name) {
      output.space()
      output.print('from')
      output.space()
      this.module_name.print(output)
    }
    if ((this.exported_value &&
                !(is_ast_defun(this.exported_value) ||
                    is_ast_function(this.exported_value) ||
                    is_ast_class(this.exported_value))) ||
            this.module_name != undefined || this.exported_names.length > 0
    ) {
      output.semicolon()
    }
  }

  public static documentation = 'An `export` statement'
  public static propdoc ={
    exported_definition: '[AST_Defun|AST_Definitions|AST_DefClass?] An exported definition',
    exported_value: '[AST_Node?] An exported value',
    exported_names: '[AST_NameMapping*?] List of exported names',
    module_name: '[AST_String?] Name of the file to load exports from',
    is_default: '[boolean] Whether this is the default exported value of this module'
  }

  public static PROPS =AST_Statement.PROPS.concat(['exported_definition', 'exported_value', 'is_default', 'exported_names', 'module_name'])
  public constructor (args: AST_Export_Props) {
    super(args)
    this.exported_definition = args.exported_definition
    this.exported_value = args.exported_value
    this.is_default = args.is_default ?? false
    this.exported_names = args.exported_names ?? []
    this.module_name = args.module_name
  }
}

export interface AST_Export_Props extends AST_Statement_Props {
  exported_definition?: AST_Defun|AST_Definitions|AST_DefClass | undefined
  exported_value?: AST_Node | undefined
  is_default?: boolean
  exported_names?: AST_NameMapping[] | null
  module_name?: AST_String | undefined
}
