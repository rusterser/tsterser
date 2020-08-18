import AST_SymbolRef from './symbol-ref'

export default class AST_SymbolExport extends AST_SymbolRef {
  _optimize = function (self) {
    return self
  }

  static documentation = 'Symbol referring to a name to export'

  static PROPS = AST_SymbolRef.PROPS
  constructor (args?) { // eslint-disable-line
    super(args)
  }
}