import AST_SymbolDeclaration, { AST_SymbolDeclaration_Props } from './symbol-declaration'

export default class AST_SymbolClass extends AST_SymbolDeclaration {
  static documentation = "Symbol naming a class's name. Lexically scoped to the class."

  static PROPS = AST_SymbolDeclaration.PROPS
}

export interface AST_SymbolClass_Props extends AST_SymbolDeclaration_Props {
}
