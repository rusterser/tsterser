/// <reference lib="es2015" />

import { RawSourceMap } from 'source-map'
import { DefaultsError } from '../lib/utils'

/** @deprecated since this versions basically do not exist */
type ECMA_UNOFFICIAL = 6 | 7 | 8 | 9 | 10 | 11

export type ECMA = 5 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | ECMA_UNOFFICIAL

export interface Comment {
  value: string
  type: 'comment1' | 'comment2' | 'comment3' | 'comment4' | 'comment5'
  pos: number
  line: number
  col: number
  nlb?: boolean
}

export interface ParseOptions {
  bare_returns?: boolean
  ecma?: ECMA
  html5_comments?: boolean
  shebang?: boolean
  toplevel?: any
  filename?: string
  strict?: boolean
  expression?: boolean
  module?: boolean
}

export interface CompressOptions {
  arguments?: boolean
  arrows?: boolean
  booleans_as_integers?: boolean
  booleans?: boolean
  collapse_vars?: boolean
  comparisons?: boolean
  computed_props?: boolean
  conditionals?: boolean
  dead_code?: boolean
  defaults?: boolean
  directives?: boolean
  drop_console?: boolean
  drop_debugger?: boolean
  ecma?: ECMA
  evaluate?: boolean
  expression?: boolean
  global_defs?: object
  hoist_funs?: boolean
  hoist_props?: boolean
  hoist_vars?: boolean
  ie8?: boolean
  if_return?: boolean
  inline?: boolean | InlineFunctions
  join_vars?: boolean
  keep_classnames?: boolean | RegExp
  keep_fargs?: boolean
  keep_fnames?: boolean | RegExp
  keep_infinity?: boolean
  loops?: boolean
  module?: boolean
  negate_iife?: boolean
  passes?: number
  properties?: boolean
  pure_funcs?: string[]
  pure_getters?: boolean | 'strict'
  reduce_funcs?: boolean
  reduce_vars?: boolean
  sequences?: boolean | number
  side_effects?: boolean
  switches?: boolean
  toplevel?: boolean
  top_retain?: null | string | string[] | RegExp
  typeofs?: boolean
  unsafe_arrows?: boolean
  unsafe?: boolean
  unsafe_comps?: boolean
  unsafe_Function?: boolean
  unsafe_math?: boolean
  unsafe_symbols?: boolean
  unsafe_methods?: boolean
  unsafe_proto?: boolean
  unsafe_regexp?: boolean
  unsafe_undefined?: boolean
  unused?: boolean
  warnings?: boolean | 'verbose'
}

export enum InlineFunctions {
  Disabled = 0,
  SimpleFunctions = 1,
  WithArguments = 2,
  WithArgumentsAndVariables = 3
}

export interface MangleOptions {
  ie8?: boolean
  eval?: boolean
  keep_classnames?: boolean | RegExp
  keep_fnames?: boolean | RegExp
  module?: boolean
  properties?: false | ManglePropertiesOptions
  reserved?: Set<string>
  safari10?: boolean
  toplevel?: boolean
  cache?: false | { props: Map<string, string> }
}

export interface ManglePropertiesOptions {
  builtins?: boolean
  debug?: boolean | string
  keep_quoted?: boolean | 'strict'
  regex?: RegExp | string
  reserved?: string[]
  cache?: any
  undeclared?: any
  only_cache?: boolean
}

export interface OutputOptions {
  ascii_only?: boolean
  beautify?: boolean
  braces?: boolean
  comments?: boolean | 'all' | 'some' | RegExp | ((node: AST_Node, comment: Comment) => boolean)
  ecma?: ECMA
  ie8?: boolean
  indent_level?: number
  indent_start?: number
  inline_script?: boolean
  keep_quoted_props?: boolean
  max_line_len?: number | false
  preamble?: string
  preserve_annotations?: boolean
  quote_keys?: boolean
  quote_style?: OutputQuoteStyle
  safari10?: boolean
  semicolons?: boolean
  shebang?: boolean
  shorthand?: boolean
  // source_map?: SourceMapOptions;
  source_map?: any
  webkit?: boolean
  width?: number
  wrap_iife?: boolean
  wrap_func_args?: boolean
  ast?: any
  code?: any
  keep_numbers?: boolean
}

export enum OutputQuoteStyle {
  PreferDouble = 0,
  AlwaysSingle = 1,
  AlwaysDouble = 2,
  AlwaysOriginal = 3
}

export interface MinifyOptions {
  compress?: false | CompressOptions
  ecma?: ECMA
  ie8?: boolean
  keep_classnames?: boolean | RegExp
  keep_fnames?: boolean | RegExp
  mangle?: false | MangleOptions
  module?: boolean
  nameCache?: AnyObject
  output?: OutputOptions
  parse?: ParseOptions
  safari10?: boolean
  sourceMap?: false | SourceMapOptions
  toplevel?: boolean
  warnings?: boolean | 'verbose'
  timings?: boolean
  rename?: boolean
  wrap?: boolean
  enclose?: boolean
}

export interface MinifyOutput {
  ast?: AST_Node
  code?: string
  error?: DefaultsError
  map?: RawSourceMap | string
  warnings?: string[]
}

export interface SourceMapOptions {
  /** Source map object, 'inline' or source map file content */
  content?: RawSourceMap | string
  includeSources?: boolean
  filename?: string
  root?: string
  url?: string | 'inline'
  asObject?: any
}

declare function parse (text: string, options?: ParseOptions): AST_Node

export class TreeWalker {
  constructor (callback: (node: AST_Node, descend?: (node: AST_Node) => void) => boolean | undefined);
  directives: AnyObject
  find_parent (type: typeof AST_Node): AST_Node | undefined;
  has_directive (type: string): any;
  loopcontrol_target (node: AST_Node): AST_Node | undefined;
  parent (n?: number): AST_Node | undefined;
  pop (): void;
  push (node: AST_Node): void;
  self (): AST_Node | undefined;
  stack: AST_Node[]
  visit: (node: AST_Node, descend: boolean) => any
  _visit: (node: AST_Node, descend?: Function) => any
}

export class TreeTransformer extends TreeWalker {
  constructor (
    before: (node: AST_Node, descend?: (node: AST_Node, tw: TreeWalker) => void, in_list?: boolean) => AST_Node | undefined,
    after?: (node: AST_Node, in_list?: boolean) => AST_Node | undefined
  );
  before: (node: AST_Node, descend: Function, in_list?: boolean) => AST_Node
  after?: (node: AST_Node, in_list?: boolean) => AST_Node
}

export function push_uniq<T> (array: T[], el: T): void

export function minify (files: string | string[] | { [file: string]: string } | AST_Node, options?: MinifyOptions): MinifyOutput

interface Token {
  value: string
  type: string
  pos: number
  line: number
  col: number
  nlb?: boolean
  file: string
  raw: string
  quote: string
  endpos: number | null
  endline: number | null
  endcol: number | null
  comments_before: Comment[]
  comments_after: Comment[]
  end: any
}

export class AST_Node {
  constructor (props?: object);
  static BASE?: AST_Node
  static PROPS: string[]
  static SELF_PROPS: string[]
  static SUBCLASSES: AST_Node[]
  static documentation: string
  static propdoc?: Record<string, string>
  static expressions?: AST_Node[]
  static warn?: (text: string, props?: AnyObject) => void
  static warn_function: Function | null
  static from_mozilla_ast?: (node: AST_Node) => any
  print: Function
  _print: Function
  _eval: Function
  evaluate: Function
  size?: Function
  _size?: Function
  walk: (visitor: TreeWalker) => void
  _walk: (visitor: TreeWalker) => void
  print_to_string: (options?: OutputOptions) => string
  transform: (tt: TreeTransformer, in_list?: boolean) => AST_Node
  TYPE: string
  value?: any
  label?: any
  shallow_cmp?: Function
  CTOR: typeof AST_Node
  to_mozilla_ast: Function
  start: Token
  end: Token
  expression: AST_Node
  name: any
  drop_side_effect_free: Function
  definition: Function
  equivalent_to: (node: AST_Node) => boolean
  may_throw_on_access: Function
  has_side_effects: Function
  is_constant_expression: Function
  clone: Function
  definitions: any[]
  fixed_value: any
  unreferenced: Function
  scope: AST_Node
  is_constant: Function
  negate: Function
  is_string: Function
  contains_this: Function
  getValue: Function
  properties: any[]
  may_throw: Function
  _children_backwards: Function
  _annotations: any
  is_block_scope: Function
  block_scope: AST_Scope | null
  reduce_vars: Function
  left: AST_Node
  right: AST_Node
  key: any
  _find_defs: Function
  is_boolean: () => boolean
  flags: number
  quote: string
  range: any
  _codegen: (node: AST_Node, output: OutputStreamReturnType) => any
  add_source_map: (output: OutputStreamReturnType) => any
  needs_parens: (output: OutputStreamReturnType) => any
  _do_print_body: Function
  _do_print: Function
  loc: any
  argument: any[]
  optimize: Function
}

declare class SymbolDef {
  constructor (scope?: AST_Scope, orig?: object, init?: object);
  name: string
  orig: AST_SymbolRef[]
  init: AST_SymbolRef
  eliminated: number
  scope: AST_Scope
  references: AST_SymbolRef[]
  replaced: number
  global: boolean
  export: number
  mangled_name: null | string
  undeclared: boolean
  id: number
  unmangleable: Function
}

type ArgType = AST_SymbolFunarg | AST_DefaultAssign | AST_Destructuring | AST_Expansion

declare class AST_Statement extends AST_Node {
  constructor (props?: object);
  body: AST_Node[] | AST_Node
}

declare class AST_Debugger extends AST_Statement {
  constructor (props?: object);
}

declare class AST_Directive extends AST_Statement {
  constructor (props?: object);
  value: string
  quote: string
}

declare class AST_SimpleStatement extends AST_Statement {
  constructor (props?: object);
  body: AST_Node[] | AST_Node
}

declare class AST_Block extends AST_Statement {
  constructor (props?: object);
  body: AST_Node[]
  block_scope: AST_Scope | null
}

declare class AST_BlockStatement extends AST_Block {
  constructor (props?: object);
}

declare class AST_Scope extends AST_Block {
  constructor (props?: object);
  variables: Map<string, SymbolDef>
  functions: any
  uses_with: boolean
  uses_eval: boolean
  parent_scope: AST_Scope | null
  enclosed: any
  cname: any
  init_scope_vars: Function
  hoist_properties: () => AST_Scope
  hoist_declarations: () => AST_Scope
  drop_unused: Function
  find_variable: Function
  is_block_scope: Function
  get_defun_scope: Function
  def_variable: Function
  add_var_name: Function
  _block_scope: boolean
  _var_name_cache: Set<string> | null
  _added_var_names: Set<string> | null
}

declare class AST_Toplevel extends AST_Scope {
  constructor (props?: object);
  globals: any
  def_global?: Function
  process_expression: Function
  resolve_defines: Function
  figure_out_scope: Function
  drop_console: Function
  reset_opt_flags: Function
}

declare class AST_Lambda extends AST_Scope {
  constructor (props?: object);
  name: AST_SymbolDeclaration | AST_Node | null
  argnames: ArgType[]
  uses_arguments: boolean
  is_generator: boolean
  async: boolean
  pinned?: Function
  make_var_name: Function
}

declare class AST_Accessor extends AST_Lambda {
  constructor (props?: object);
}

declare class AST_Function extends AST_Lambda {
  constructor (props?: object);
}

declare class AST_Arrow extends AST_Lambda {
  constructor (props?: object);
}

declare class AST_Defun extends AST_Lambda {
  constructor (props?: object);
}

declare class AST_Class extends AST_Scope {
  constructor (props?: object);
  name: AST_SymbolClass | AST_SymbolDefClass | null
  extends: AST_Node | null
  properties: AST_ObjectProperty[]
}

declare class AST_DefClass extends AST_Class {
  constructor (props?: object);
}

declare class AST_ClassExpression extends AST_Class {
  constructor (props?: object);
}

declare class AST_Switch extends AST_Block {
  constructor (props?: object);
  expression: AST_Node
}

declare class AST_SwitchBranch extends AST_Block {
  constructor (props?: object);
}

declare class AST_Default extends AST_SwitchBranch {
  constructor (props?: object);
}

declare class AST_Case extends AST_SwitchBranch {
  constructor (props?: object);
  expression: AST_Node
}

declare class AST_Try extends AST_Block {
  constructor (props?: object);
  bcatch: AST_Catch
  bfinally: null | AST_Finally
}

declare class AST_Catch extends AST_Block {
  constructor (props?: object);
  argname: ArgType
}

declare class AST_Finally extends AST_Block {
  constructor (props?: object);
}

declare class AST_EmptyStatement extends AST_Statement {
  constructor (props?: object);
}

declare class AST_StatementWithBody extends AST_Statement {
  constructor (props?: object);
  body: AST_Node[] | AST_Node
}

declare class AST_LabeledStatement extends AST_StatementWithBody {
  constructor (props?: object);
  label: AST_Label
}

declare class AST_IterationStatement extends AST_StatementWithBody {
  constructor (props?: object);
  block_scope: AST_Scope | null
}

declare class AST_DWLoop extends AST_IterationStatement {
  constructor (props?: object);
  condition: AST_Node
}

declare class AST_Do extends AST_DWLoop {
  constructor (props?: object);
}

declare class AST_While extends AST_DWLoop {
  constructor (props?: object);
}

declare class AST_For extends AST_IterationStatement {
  constructor (props?: object);
  init: AST_Node | null
  condition: AST_Node | null
  step: AST_Node | null
}

declare class AST_ForIn extends AST_IterationStatement {
  constructor (props?: object);
  init: AST_Node | null
  object: AST_Node
  await: boolean
}

declare class AST_ForOf extends AST_ForIn {
  constructor (props?: object);
}

declare class AST_With extends AST_StatementWithBody {
  constructor (props?: object);
  expression: AST_Node
}

declare class AST_If extends AST_StatementWithBody {
  constructor (props?: object);
  condition: AST_Node
  alternative: AST_Node | null
}

declare class AST_Jump extends AST_Statement {
  constructor (props?: object);
}

declare class AST_Exit extends AST_Jump {
  constructor (props?: object);
  value: AST_Node | null
}

declare class AST_Return extends AST_Exit {
  constructor (props?: object);
}

declare class AST_Throw extends AST_Exit {
  constructor (props?: object);
}

declare class AST_LoopControl extends AST_Jump {
  constructor (props?: object);
  label: null | AST_LabelRef
}

declare class AST_Break extends AST_LoopControl {
  constructor (props?: object);
}

declare class AST_Continue extends AST_LoopControl {
  constructor (props?: object);
}

declare class AST_Definitions extends AST_Statement {
  constructor (props?: object);
  definitions: AST_VarDef[]
  to_assignments: Function
}

declare class AST_Var extends AST_Definitions {
  constructor (props?: object);
  remove_initializers: Function
}

declare class AST_Let extends AST_Definitions {
  constructor (props?: object);
}

declare class AST_Const extends AST_Definitions {
  constructor (props?: object);
}

declare class AST_Export extends AST_Statement {
  constructor (props?: object);
  exported_definition: AST_Definitions | AST_Lambda | AST_DefClass | null
  exported_value: AST_Node | null
  is_default: boolean
  exported_names: AST_NameMapping[]
  module_name: AST_String
}

declare class AST_Expansion extends AST_Node {
  constructor (props?: object);
  expression: AST_Node
}

declare class AST_Destructuring extends AST_Node {
  constructor (props?: object);
  names: AST_Node[]
  is_array: boolean
}

declare class AST_PrefixedTemplateString extends AST_Node {
  constructor (props?: object);
  template_string: AST_TemplateString
  prefix: AST_Node
}

declare class AST_TemplateString extends AST_Node {
  constructor (props?: object);
  // segments: AST_Node[];
  segments: AST_TemplateSegment[]
}

declare class AST_TemplateSegment extends AST_Node {
  constructor (props?: object);
  value: string
  raw: string
}

declare class AST_NameMapping extends AST_Node {
  constructor (props?: object);
  foreign_name: AST_Symbol
  name: AST_SymbolExport | AST_SymbolImport
}

declare class AST_Import extends AST_Node {
  constructor (props?: object);
  imported_name: null | AST_SymbolImport
  imported_names: AST_NameMapping[]
  module_name: AST_String
}

declare class AST_VarDef extends AST_Node {
  constructor (props?: object);
  name: AST_Destructuring | AST_SymbolConst | AST_SymbolLet | AST_SymbolVar
  value: AST_Node | null
}

declare class AST_Call extends AST_Node {
  constructor (props?: object);
  expression: AST_Node
  args: AST_Node[]
  is_expr_pure: Function
}

declare class AST_New extends AST_Call {
  constructor (props?: object);
}

declare class AST_Sequence extends AST_Node {
  constructor (props?: object);
  expressions: AST_Node[]
  tail_node: Function
}

declare class AST_PropAccess extends AST_Node {
  constructor (props?: object);
  expression: AST_Node
  property: AST_Node | string
}

declare class AST_Dot extends AST_PropAccess {
  constructor (props?: object);
}

declare class AST_Sub extends AST_PropAccess {
  constructor (props?: object);
}

declare class AST_Unary extends AST_Node {
  constructor (props?: object);
  operator: string
  expression: AST_Node
}

declare class AST_UnaryPrefix extends AST_Unary {
  constructor (props?: object);
}

declare class AST_UnaryPostfix extends AST_Unary {
  constructor (props?: object);
}

declare class AST_Binary extends AST_Node {
  constructor (props?: object);
  operator: string
  left: AST_Node
  right: AST_Node
}

declare class AST_Assign extends AST_Binary {
  constructor (props?: object);
}

declare class AST_DefaultAssign extends AST_Binary {
  constructor (props?: object);
}

declare class AST_Conditional extends AST_Node {
  constructor (props?: object);
  condition: AST_Node
  consequent: AST_Node
  alternative: AST_Node
}

declare class AST_Array extends AST_Node {
  constructor (props?: object);
  elements: AST_Node[]
}

declare class AST_Object extends AST_Node {
  constructor (props?: object);
  properties: AST_ObjectProperty[]
}

declare class AST_ObjectProperty extends AST_Node {
  constructor (props?: object);
  // TODO: check type
  // key: string | number | AST_Node;
  key: any
  value: AST_Node
  quote: string
  is_generator: boolean
  static: boolean
  _print_getter_setter: Function
}

declare class AST_ObjectKeyVal extends AST_ObjectProperty {
  constructor (props?: object);
  quote: string
}

declare class AST_ObjectSetter extends AST_ObjectProperty {
  constructor (props?: object);
  quote: string
}

declare class AST_ObjectGetter extends AST_ObjectProperty {
  constructor (props?: object);
  quote: string
}

declare class AST_ConciseMethod extends AST_ObjectProperty {
  constructor (props?: object);
  quote: string
  is_generator: boolean
  async: boolean
}

declare class AST_Symbol extends AST_Node {
  constructor (props?: object);
  scope: AST_Scope
  name: string
  thedef: SymbolDef
  unmangleable: Function
}

declare class AST_SymbolDeclaration extends AST_Symbol {
  constructor (props?: object);
  init: AST_Node | null
  names: AST_Node[]
  is_array: AST_Node[]
  mark_enclosed: Function
  reference: Function
}

declare class AST_SymbolVar extends AST_SymbolDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolFunarg extends AST_SymbolVar {
  constructor (props?: object);
}

declare class AST_SymbolBlockDeclaration extends AST_SymbolDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolConst extends AST_SymbolBlockDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolLet extends AST_SymbolBlockDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolDefClass extends AST_SymbolBlockDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolCatch extends AST_SymbolBlockDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolImport extends AST_SymbolBlockDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolDefun extends AST_SymbolDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolLambda extends AST_SymbolDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolClass extends AST_SymbolDeclaration {
  constructor (props?: object);
}

declare class AST_SymbolMethod extends AST_Symbol {
  constructor (props?: object);
}

declare class AST_SymbolImportForeign extends AST_Symbol {
  constructor (props?: object);
}

declare class AST_Label extends AST_Symbol {
  constructor (props?: object);
  references: AST_LoopControl | null
  mangled_name: null | string
}

declare class AST_SymbolRef extends AST_Symbol {
  constructor (props?: object);
  reference: Function
  is_immutable: Function
  is_declared: Function
}

declare class AST_SymbolExport extends AST_SymbolRef {
  constructor (props?: object);
}

declare class AST_SymbolExportForeign extends AST_Symbol {
  constructor (props?: object);
}

declare class AST_LabelRef extends AST_Symbol {
  constructor (props?: object);
}

declare class AST_This extends AST_Symbol {
  constructor (props?: object);
}

declare class AST_Super extends AST_This {
  constructor (props?: object);
}

declare class AST_NewTarget extends AST_Node {
  constructor (props?: object);
}

declare class AST_Constant extends AST_Node {
  constructor (props?: object);
}

declare class AST_String extends AST_Constant {
  constructor (props?: object);
  value: string
  quote: string
}

declare class AST_Number extends AST_Constant {
  constructor (props?: object);
  value: number
  literal: string
}

declare class AST_RegExp extends AST_Constant {
  constructor (props?: object);
  value: {
    source: string
    flags: string
  }
}

declare class AST_Atom extends AST_Constant {
  constructor (props?: object);
}

declare class AST_Null extends AST_Atom {
  constructor (props?: object);
}

declare class AST_NaN extends AST_Atom {
  constructor (props?: object);
}

declare class AST_Undefined extends AST_Atom {
  constructor (props?: object);
}

declare class AST_Hole extends AST_Atom {
  constructor (props?: object);
}

declare class AST_Infinity extends AST_Atom {
  constructor (props?: object);
}

declare class AST_Boolean extends AST_Atom {
  constructor (props?: object);
}

declare class AST_False extends AST_Boolean {
  constructor (props?: object);
}

declare class AST_True extends AST_Boolean {
  constructor (props?: object);
}

declare class AST_Await extends AST_Node {
  constructor (props?: object);
  expression: AST_Node
}

declare class AST_Yield extends AST_Node {
  constructor (props?: object);
  expression: AST_Node
  is_star: boolean
}

export interface OutputStreamReturnType {
  get: () => string
  active_scope: AST_Scope | null
  use_asm: AST_Scope | null
  pop_node: Function
  prepend_comments: (node: AST_Node) => any
  append_comments: ((node: AST_Node, tail?: boolean) => any) | (() => void)
  push_node: (node: AST_Node) => any
  with_parens: (func: () => any) => any
  print_string: Function
  semicolon: () => void
  print: (str: string) => any
  comma: () => void
  colon: () => void
  space: () => void
  star: () => void
  force_semicolon: () => void
  print_template_string_chars: Function
  with_block: Function
  indent: Function
  newline: Function
  add_mapping: Function
  print_name: Function
  last: Function
  with_square: Function
  option: (option: keyof OutputOptions) => any
  in_directive: boolean
  to_utf8: (str: string) => string
  toString: () => string
  indentation: () => number
  current_width: () => number
  next_indent: () => number
  should_break: () => boolean
  has_parens: () => boolean
  encode_string: (str: string, quote: string) => string
  with_indent: (col: boolean | number, cont: Function) => any
  printed_comments: Set<Comment[]>
  line: () => number
  col: () => number
  pos: () => number
  parent: (n?: number) => any
}
