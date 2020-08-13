import AST_Node from './node'
import { pass_through } from '../utils'

export default class AST_NameMapping extends AST_Node {
  name: any
  foreign_name: any

  _walk (visitor: any) {
    return visitor._visit(this, function () {
      this.foreign_name._walk(visitor)
      this.name._walk(visitor)
    })
  }

  _children_backwards (push: Function) {
    push(this.name)
    push(this.foreign_name)
  }

  _size (): number {
    // foreign name isn't mangled
    return this.name ? 4 : 0
  }

  shallow_cmp = pass_through
  _transform (self, tw: any) {
    self.foreign_name = self.foreign_name.transform(tw)
    self.name = self.name.transform(tw)
  }

  _codegen (self, output) {
    var is_import = output.parent()?.isAst?.('AST_Import')
    var definition = self.name.definition()
    var names_are_different =
            (definition && definition.mangled_name || self.name.name) !==
            self.foreign_name.name
    if (names_are_different) {
      if (is_import) {
        output.print(self.foreign_name.name)
      } else {
        self.name.print(output)
      }
      output.space()
      output.print('as')
      output.space()
      if (is_import) {
        self.name.print(output)
      } else {
        output.print(self.foreign_name.name)
      }
    } else {
      self.name.print(output)
    }
  }

  static documentation = 'The part of the export/import statement that declare names from a module.'
  static propdoc = {
    foreign_name: '[AST_SymbolExportForeign|AST_SymbolImportForeign] The name being exported/imported (as specified in the module)',
    name: '[AST_SymbolExport|AST_SymbolImport] The name as it is visible to this module.'
  }

  static PROPS = AST_Node.PROPS.concat(['foreign_name', 'name'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.foreign_name = args.foreign_name
    this.name = args.name
  }
}
