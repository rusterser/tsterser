import AST_Block from './block'
import TreeTransformer from '../tree-transformer'
import TreeWalker from '../tree-walker'
import SymbolDef from '../symbol-def'
import AST_SymbolBlockDeclaration from './symbol-block-declaration'
import { js_error } from '../parse'

import {
  make_node,
  return_false,
  keep_name,
  walk,
  MAP,
  remove,
  can_be_evicted_from_block,
  make_sequence,
  push_uniq,
  get_value,
  init_scope_vars,
  next_mangled,
  maintain_this_binding,
  redefined_catch_def,
  is_ref_of,
  string_template,
  is_empty,
  defaults,
  map_add
} from '../utils'

import {
  has_flag,
  set_flag,
  UNUSED,
  MASK_EXPORT_WANT_MANGLE,
  MASK_EXPORT_DONT_MANGLE,
  WRITE_ONLY
} from '../constants'

export default class AST_Scope extends AST_Block {
  functions: any
  globals: any
  variables: any
  enclosed: any
  _added_var_names?: Set<any>
  _var_name_cache: any
  parent_scope: any
  uses_eval: any
  uses_with: any
  cname: any

  process_expression (insert, compressor) {
    var self = this
    var tt = new TreeTransformer(function (node: any) {
      if (insert && node?.isAst?.('AST_SimpleStatement')) {
        return make_node('AST_Return', node, {
          value: node.body
        })
      }
      if (!insert && node?.isAst?.('AST_Return')) {
        if (compressor) {
          var value = node.value && node.value.drop_side_effect_free?.(compressor, true)
          return value ? make_node('AST_SimpleStatement', node, {
            body: value
          }) : make_node('AST_EmptyStatement', node)
        }
        return make_node('AST_SimpleStatement', node, {
          body: node.value || make_node('AST_UnaryPrefix', node, {
            operator: 'void',
            expression: make_node('AST_Number', node, {
              value: 0
            })
          })
        })
      }
      if (node?.isAst?.('AST_Class') || node?.isAst?.('AST_Lambda') && (node) !== self) {
        return node
      }
      if (node?.isAst?.('AST_Block')) {
        var index = node.body.length - 1
        if (index >= 0) {
          node.body[index] = node.body[index].transform(tt)
        }
      } else if (node?.isAst?.('AST_If')) {
        node.body = (node.body).transform(tt)
        if (node.alternative) {
          node.alternative = node.alternative.transform(tt)
        }
      } else if (node?.isAst?.('AST_With')) {
        node.body = (node.body).transform(tt)
      }
      return node
    })
    self.transform(tt)
  }

  drop_unused (compressor: any) {
    const optUnused = compressor.option('unused')
    if (!optUnused) return
    if (compressor.has_directive('use asm')) return
    var self = this
    if (self.pinned()) return
    var drop_funcs = !(self?.isAst?.('AST_Toplevel')) || compressor.toplevel.funcs
    var drop_vars = !(self?.isAst?.('AST_Toplevel')) || compressor.toplevel.vars
    const assign_as_unused = typeof optUnused === 'string' && optUnused.includes('keep_assign') ? return_false : function (node: any) {
      if (node?.isAst?.('AST_Assign') &&
              (has_flag(node, WRITE_ONLY) || node.operator == '=')
      ) {
        return node.left
      }
      if (node?.isAst?.('AST_Unary') && has_flag(node, WRITE_ONLY)) {
        return node.expression
      }
    }
    var in_use_ids = new Map()
    var fixed_ids = new Map()
    if (self?.isAst?.('AST_Toplevel') && compressor.top_retain) {
      self.variables.forEach(function (def) {
        if (compressor.top_retain?.(def) && !in_use_ids.has(def.id)) {
          in_use_ids.set(def.id, def)
        }
      })
    }
    var var_defs_by_id = new Map()
    var initializations = new Map()
    // pass 1: find out which symbols are directly used in
    // this scope (not in nested scopes).
    var scope: any = this
    var tw = new TreeWalker(function (node: any, descend) {
      if (node?.isAst?.('AST_Lambda') && node.uses_arguments && !tw.has_directive('use strict')) {
        node.argnames.forEach(function (argname) {
          if (!(argname?.isAst?.('AST_SymbolDeclaration'))) return
          var def = argname.definition?.()
          if (!in_use_ids.has(def.id)) {
            in_use_ids.set(def.id, def)
          }
        })
      }
      if (node === self) return
      if (node?.isAst?.('AST_Defun') || node?.isAst?.('AST_DefClass')) {
        var node_def = node.name?.definition?.()
        const in_export = tw.parent()?.isAst?.('AST_Export')
        if (in_export || !drop_funcs && scope === self) {
          if (node_def.global && !in_use_ids.has(node_def.id)) {
            in_use_ids.set(node_def.id, node_def)
          }
        }
        if (node?.isAst?.('AST_DefClass')) {
          if (
            node.extends &&
                      (node.extends.has_side_effects(compressor) ||
                      node.extends.may_throw(compressor))
          ) {
            node.extends.walk(tw)
          }
          for (const prop of node.properties) {
            if (
              prop.has_side_effects(compressor) ||
                          prop.may_throw(compressor)
            ) {
              prop.walk(tw)
            }
          }
        }
        map_add(initializations, node_def.id, node)
        return true // don't go in nested scopes
      }
      if (node?.isAst?.('AST_SymbolFunarg') && scope === self) {
        map_add(var_defs_by_id, node.definition?.().id, node)
      }
      if (node?.isAst?.('AST_Definitions') && scope === self) {
        const in_export = tw.parent()?.isAst?.('AST_Export')
        node.definitions.forEach(function (def) {
          if (def.name?.isAst?.('AST_SymbolVar')) {
            map_add(var_defs_by_id, def.name.definition?.().id, def)
          }
          if (in_export || !drop_vars) {
            walk(def.name, (node: any) => {
              if (node?.isAst?.('AST_SymbolDeclaration')) {
                const def = node.definition?.()
                if (
                  (in_export || def.global) &&
                                  !in_use_ids.has(def.id)
                ) {
                  in_use_ids.set(def.id, def)
                }
              }
            })
          }
          if (def.value) {
            if (def.name?.isAst?.('AST_Destructuring')) {
              def.walk(tw)
            } else {
              var node_def = def.name.definition?.()
              map_add(initializations, node_def.id, def.value)
              if (!node_def.chained && def.name.fixed_value() === def.value) {
                fixed_ids.set(node_def.id, def)
              }
            }
            if (def.value.has_side_effects(compressor)) {
              def.value.walk(tw)
            }
          }
        })
        return true
      }
      return scan_ref_scoped(node, descend)
    })
    self.walk(tw)
    // pass 2: for every used symbol we need to walk its
    // initialization code to figure out if it uses other
    // symbols (that may not be in_use).
    tw = new TreeWalker(scan_ref_scoped)
    in_use_ids.forEach(function (def) {
      var init = initializations.get(def.id)
      if (init) {
        init.forEach(function (init) {
          init.walk(tw)
        })
      }
    })
    // pass 3: we should drop declarations not in_use
    var tt = new TreeTransformer(
      function before (node, descend, in_list) {
        var parent = tt.parent()
        if (drop_vars) {
          const sym = assign_as_unused(node)
          if (sym?.isAst?.('AST_SymbolRef')) {
            var def = sym.definition?.()
            var in_use = in_use_ids.has(def.id)
            if (node?.isAst?.('AST_Assign')) {
              if (!in_use || fixed_ids.has(def.id) && fixed_ids.get(def.id) !== node) {
                return maintain_this_binding(parent, node, node.right.transform(tt))
              }
            } else if (!in_use) {
              return in_list ? MAP.skip : make_node('AST_Number', node, {
                value: 0
              })
            }
          }
        }
        if (scope !== self) return
        var def
        if (node.name &&
                  (node?.isAst?.('AST_ClassExpression') &&
                      !keep_name(compressor.option('keep_classnames'), (def = node.name?.definition?.()).name) ||
                  node?.isAst?.('AST_Function') &&
                      !keep_name(compressor.option('keep_fnames'), (def = node.name?.definition?.()).name))) {
          // any declarations with same name will overshadow
          // name of this anonymous function and can therefore
          // never be used anywhere
          if (!in_use_ids.has(def.id) || def.orig.length > 1) node.name = null
        }
        if (node?.isAst?.('AST_Lambda') && !(node?.isAst?.('AST_Accessor'))) {
          var trim = !compressor.option('keep_fargs')
          for (var a = node.argnames, i = a.length; --i >= 0;) {
            var sym = a[i]
            if (sym?.isAst?.('AST_Expansion')) {
              sym = sym.expression
            }
            if (sym?.isAst?.('AST_DefaultAssign')) {
              sym = sym.left
            }
            // Do not drop destructuring arguments.
            // They constitute a type assertion, so dropping
            // them would stop that TypeError which would happen
            // if someone called it with an incorrectly formatted
            // parameter.
            if (!(sym?.isAst?.('AST_Destructuring')) && !in_use_ids.has(sym.definition?.().id)) {
              set_flag(sym, UNUSED)
              if (trim) {
                a.pop()
                compressor[sym.unreferenced() ? 'warn' : 'info']('Dropping unused function argument {name} [{file}:{line},{col}]', template(sym))
              }
            } else {
              trim = false
            }
          }
        }
        if ((node?.isAst?.('AST_Defun') || node?.isAst?.('AST_DefClass')) && (node) !== self) {
          const def = node.name?.definition?.()
          const keep = def.global && !drop_funcs || in_use_ids.has(def.id)
          if (!keep) {
            compressor[node.name?.unreferenced() ? 'warn' : 'info']('Dropping unused function {name} [{file}:{line},{col}]', template(node.name))
            def.eliminated++
            if (node?.isAst?.('AST_DefClass')) {
              // Classes might have extends with side effects
              const side_effects = node.drop_side_effect_free(compressor)
              if (side_effects) {
                return make_node('AST_SimpleStatement', node, {
                  body: side_effects
                })
              }
            }
            return in_list ? MAP.skip : make_node('AST_EmptyStatement', node)
          }
        }
        if (node?.isAst?.('AST_Definitions') && !(parent?.isAst?.('AST_ForIn') && parent.init === node)) {
          var drop_block = !(parent?.isAst?.('AST_Toplevel')) && !(node?.isAst?.('AST_Var'))
          // place uninitialized names at the start
          var body: any[] = []; var head: any[] = []; var tail: any[] = []
          // for unused names whose initialization has
          // side effects, we can cascade the init. code
          // into the next one, or next statement.
          var side_effects: any[] = []
          node.definitions.forEach(function (def) {
            if (def.value) def.value = def.value.transform(tt)
            var is_destructure = def.name?.isAst?.('AST_Destructuring')
            var sym = is_destructure
              ? new SymbolDef(null, { name: '<destructure>' }) /* fake SymbolDef */
              : def.name.definition?.()
            if (drop_block && sym.global) return tail.push(def)
            if (!(drop_vars || drop_block) ||
                          is_destructure &&
                              (def.name.names.length ||
                                  def.name.is_array ||
                                  compressor.option('pure_getters') != true) ||
                          in_use_ids.has(sym.id)
            ) {
              if (def.value && fixed_ids.has(sym.id) && fixed_ids.get(sym.id) !== def) {
                def.value = def.value.drop_side_effect_free(compressor)
              }
              if (def.name?.isAst?.('AST_SymbolVar')) {
                var var_defs = var_defs_by_id.get(sym.id)
                if (var_defs.length > 1 && (!def.value || sym.orig.indexOf(def.name) > sym.eliminated)) {
                  compressor.warn('Dropping duplicated definition of variable {name} [{file}:{line},{col}]', template(def.name))
                  if (def.value) {
                    var ref = make_node('AST_SymbolRef', def.name, def.name)
                    sym.references.push(ref)
                    var assign = make_node('AST_Assign', def, {
                      operator: '=',
                      left: ref,
                      right: def.value
                    })
                    if (fixed_ids.get(sym.id) === def) {
                      fixed_ids.set(sym.id, assign)
                    }
                    side_effects.push(assign.transform(tt))
                  }
                  remove(var_defs, def)
                  sym.eliminated++
                  return
                }
              }
              if (def.value) {
                if (side_effects.length > 0) {
                  if (tail.length > 0) {
                    side_effects.push(def.value)
                    def.value = make_sequence(def.value, side_effects)
                  } else {
                    body.push(make_node('AST_SimpleStatement', node, {
                      body: make_sequence(node, side_effects)
                    }))
                  }
                  side_effects = []
                }
                tail.push(def)
              } else {
                head.push(def)
              }
            } else if (sym.orig[0]?.isAst?.('AST_SymbolCatch')) {
              var value = def.value && def.value.drop_side_effect_free(compressor)
              if (value) side_effects.push(value)
              def.value = null
              head.push(def)
            } else {
              var value = def.value && def.value.drop_side_effect_free(compressor)
              if (value) {
                if (!is_destructure) compressor.warn('Side effects in initialization of unused variable {name} [{file}:{line},{col}]', template(def.name))
                side_effects.push(value)
              } else {
                if (!is_destructure) compressor[def.name.unreferenced() ? 'warn' : 'info']('Dropping unused variable {name} [{file}:{line},{col}]', template(def.name))
              }
              sym.eliminated++
            }
          })
          if (head.length > 0 || tail.length > 0) {
            node.definitions = head.concat(tail)
            body.push(node)
          }
          if (side_effects.length > 0) {
            body.push(make_node('AST_SimpleStatement', node, {
              body: make_sequence(node, side_effects)
            }))
          }
          switch (body.length) {
            case 0:
              return in_list ? MAP.skip : make_node('AST_EmptyStatement', node)
            case 1:
              return body[0]
            default:
              return in_list ? MAP.splice(body) : make_node('AST_BlockStatement', node, {
                body: body
              })
          }
        }
        // certain combination of unused name + side effect leads to:
        //    https://github.com/mishoo/UglifyJS2/issues/44
        //    https://github.com/mishoo/UglifyJS2/issues/1830
        //    https://github.com/mishoo/UglifyJS2/issues/1838
        // that's an invalid AST.
        // We fix it at this stage by moving the `var` outside the `for`.
        if (node?.isAst?.('AST_For')) {
          descend(node, this)
          var block
          if (node.init?.isAst?.('AST_BlockStatement')) {
            block = node.init
            node.init = block.body.pop()
            block.body.push(node)
          }
          if (node.init?.isAst?.('AST_SimpleStatement')) {
            // TODO: check type
            node.init = node.init.body
          } else if (is_empty(node.init)) {
            node.init = null
          }
          return !block ? node : in_list ? MAP.splice(block.body) : block
        }
        if (node?.isAst?.('AST_LabeledStatement') &&
                  node.body?.isAst?.('AST_For')
        ) {
          descend(node, this)
          if (node.body?.isAst?.('AST_BlockStatement')) {
            const block = node.body
            node.body = block.body.pop() // TODO: check type
            block.body.push(node)
            return in_list ? MAP.splice(block.body) : block
          }
          return node
        }
        if (node?.isAst?.('AST_BlockStatement')) {
          descend(node, this)
          if (in_list && node.body.every(can_be_evicted_from_block)) {
            return MAP.splice(node.body)
          }
          return node
        }
        if (node?.isAst?.('AST_Scope')) {
          const save_scope = scope
          scope = node
          descend(node, this)
          scope = save_scope
          return node
        }

        function template (sym) {
          return {
            name: sym.name,
            file: sym.start.file,
            line: sym.start.line,
            col: sym.start.col
          }
        }
      }
    )

    self.transform(tt)

    function scan_ref_scoped (node, descend) {
      var node_def
      const sym = assign_as_unused(node)
      if (sym?.isAst?.('AST_SymbolRef') &&
              !is_ref_of(node.left, AST_SymbolBlockDeclaration) &&
              self.variables.get(sym.name) === (node_def = sym.definition?.())
      ) {
        if (node?.isAst?.('AST_Assign')) {
          node.right.walk(tw)
          if (!node_def.chained && node.left.fixed_value() === node.right) {
            fixed_ids.set(node_def.id, node)
          }
        }
        return true
      }
      if (node?.isAst?.('AST_SymbolRef')) {
        node_def = node.definition?.()
        if (!in_use_ids.has(node_def.id)) {
          in_use_ids.set(node_def.id, node_def)
          if (node_def.orig[0]?.isAst?.('AST_SymbolCatch')) {
            const redef = node_def.scope.is_block_scope() &&
                          node_def.scope.get_defun_scope().variables.get(node_def.name)
            if (redef) in_use_ids.set(redef.id, redef)
          }
        }
        return true
      }
      if (node?.isAst?.('AST_Scope')) {
        var save_scope = scope
        scope = node
        descend()
        scope = save_scope
        return true
      }
    }
  }

  hoist_declarations (compressor: any) {
    var self = this
    if (compressor.has_directive('use asm')) return self
    // Hoisting makes no sense in an arrow func
    if (!Array.isArray(self.body)) return self

    var hoist_funs = compressor.option('hoist_funs')
    var hoist_vars = compressor.option('hoist_vars')

    if (hoist_funs || hoist_vars) {
      var dirs: any[] = []
      var hoisted: any[] = []
      var vars = new Map(); var vars_found = 0; var var_decl = 0
      // let's count var_decl first, we seem to waste a lot of
      // space if we hoist `var` when there's only one.
      walk(self, (node: any) => {
        if (node?.isAst?.('AST_Scope') && node !== self) { return true }
        if (node?.isAst?.('AST_Var')) {
          ++var_decl
          return true
        }
      })
      hoist_vars = hoist_vars && var_decl > 1
      var tt = new TreeTransformer(
        function before (node: any) {
          if (node !== self) {
            if (node?.isAst?.('AST_Directive')) {
              dirs.push(node)
              return make_node('AST_EmptyStatement', node)
            }
            if (hoist_funs && node?.isAst?.('AST_Defun') &&
                          !(tt.parent()?.isAst?.('AST_Export')) &&
                          tt.parent() === self) {
              hoisted.push(node)
              return make_node('AST_EmptyStatement', node)
            }
            if (hoist_vars && node?.isAst?.('AST_Var')) {
              node.definitions.forEach(function (def) {
                if (def.name?.isAst?.('AST_Destructuring')) return
                vars.set(def.name.name, def)
                ++vars_found
              })
              var seq = node.to_assignments(compressor)
              var p = tt.parent()
              if (p?.isAst?.('AST_ForIn') && p.init === node) {
                if (seq == null) {
                  var def = node.definitions[0].name
                  return make_node('AST_SymbolRef', def, def)
                }
                return seq
              }
              if (p?.isAst?.('AST_For') && p.init === node) {
                return seq
              }
              if (!seq) return make_node('AST_EmptyStatement', node)
              return make_node('AST_SimpleStatement', node, {
                body: seq
              })
            }
            if (node?.isAst?.('AST_Scope')) { return node } // to avoid descending in nested scopes
          }
        }
      )
      self = self.transform(tt)
      if (vars_found > 0) {
        // collect only vars which don't show up in self's arguments list
        var defs: any[] = []
        const is_lambda = self?.isAst?.('AST_Lambda')
        const args_as_names = is_lambda ? (self as any).args_as_names() : null
        vars.forEach((def, name) => {
          if (is_lambda && args_as_names.some((x) => x.name === def.name.name)) {
            vars.delete(name)
          } else {
            def = def.clone()
            def.value = null
            defs.push(def)
            vars.set(name, def)
          }
        })
        if (defs.length > 0) {
          // try to merge in assignments
          for (var i = 0; i < self.body.length;) {
            if (self.body[i]?.isAst?.('AST_SimpleStatement')) {
              var expr = self.body[i].body; var sym; var assign
              if (expr?.isAst?.('AST_Assign') &&
                              expr.operator == '=' &&
                              (sym = expr.left)?.isAst?.('AST_Symbol') &&
                              vars.has(sym.name)
              ) {
                var def = vars.get(sym.name)
                if (def.value) break
                def.value = expr.right
                remove(defs, def)
                defs.push(def)
                self.body.splice(i, 1)
                continue
              }
              if (expr?.isAst?.('AST_Sequence') &&
                              (assign = expr.expressions[0])?.isAst?.('AST_Assign') &&
                              assign.operator == '=' &&
                              (sym = assign.left)?.isAst?.('AST_Symbol') &&
                              vars.has(sym.name)
              ) {
                var def = vars.get(sym.name)
                if (def.value) break
                def.value = assign.right
                remove(defs, def)
                defs.push(def)
                self.body[i].body = make_sequence(expr, expr.expressions.slice(1))
                continue
              }
            }
            if (self.body[i]?.isAst?.('AST_EmptyStatement')) {
              self.body.splice(i, 1)
              continue
            }
            if (self.body[i]?.isAst?.('AST_BlockStatement')) {
              var tmp = [i, 1].concat(self.body[i].body)
              self.body.splice.apply(self.body, tmp)
              continue
            }
            break
          }
          defs = make_node('AST_Var', self, {
            definitions: defs
          })
          hoisted.push(defs)
        }
      }
      self.body = dirs.concat(hoisted, self.body)
    }
    return self
  }

  make_var_name (prefix) {
    var var_names = this.var_names()
    prefix = prefix.replace(/(?:^[^a-z_$]|[^a-z0-9_$])/ig, '_')
    var name = prefix
    for (var i = 0; var_names.has(name); i++) name = prefix + '$' + i
    this.add_var_name(name)
    return name
  }

  hoist_properties (compressor: any) {
    var self = this
    if (!compressor.option('hoist_props') || compressor.has_directive('use asm')) return self
    var top_retain = self?.isAst?.('AST_Toplevel') && compressor.top_retain || return_false
    var defs_by_id = new Map()
    var hoister = new TreeTransformer(function (node: any, descend) {
      if (node?.isAst?.('AST_Definitions') &&
              hoister.parent()?.isAst?.('AST_Export')) return node
      if (node?.isAst?.('AST_VarDef')) {
        const sym = node.name
        let def
        let value
        if (sym.scope === self &&
                  (def = sym.definition?.()).escaped != 1 &&
                  !def.assignments &&
                  !def.direct_access &&
                  !def.single_use &&
                  !compressor.exposed(def) &&
                  !top_retain(def) &&
                  (value = sym.fixed_value()) === node.value &&
                  value?.isAst?.('AST_Object') &&
                  value.properties.every(prop => typeof prop.key === 'string')
        ) {
          descend(node, this)
          const defs = new Map()
          const assignments: any[] = []
          value.properties.forEach(function (prop) {
            assignments.push(make_node('AST_VarDef', node, {
              name: make_sym(sym, prop.key, defs),
              value: prop.value
            }))
          })
          defs_by_id.set(def.id, defs)
          return MAP.splice(assignments)
        }
      } else if (node?.isAst?.('AST_PropAccess') &&
              node.expression?.isAst?.('AST_SymbolRef')
      ) {
        const defs = defs_by_id.get(node.expression.definition?.().id)
        if (defs) {
          const def = defs.get(String(get_value(node.property)))
          const sym = make_node('AST_SymbolRef', node, {
            name: def.name,
            scope: node.expression.scope,
            thedef: def
          })
          sym.reference({})
          return sym
        }
      }

      function make_sym (sym: any | any, key: string, defs: Map<string, any>) {
        const new_var = make_node(sym.constructor.name, sym, {
          name: self.make_var_name(sym.name + '_' + key),
          scope: self
        })
        const def = self.def_variable(new_var)
        defs.set(String(key), def)
        self.enclosed.push(def)
        return new_var
      }
    })
    return self.transform(hoister)
  }

  init_scope_vars = init_scope_vars
  var_names = function varNames (this: any): Set<string> | null {
    var var_names = this._var_name_cache
    if (!var_names) {
      this._var_name_cache = var_names = new Set(
        this.parent_scope ? varNames.call(this.parent_scope) : null
      )
      if (this._added_var_names) {
        this._added_var_names.forEach(name => { var_names?.add(name) })
      }
      this.enclosed.forEach(function (def: any) {
              var_names?.add(def.name)
      })
      this.variables.forEach(function (_, name: string) {
              var_names?.add(name)
      })
    }
    return var_names
  }

  add_var_name (name: string) {
    // TODO change enclosed too
    if (!this._added_var_names) {
      // TODO stop adding var names entirely
      this._added_var_names = new Set()
    }
    this._added_var_names.add(name)
    if (!this._var_name_cache) this.var_names() // regen cache
    this._var_name_cache.add(name)
  }

  // TODO create function that asks if we can inline
  add_child_scope (scope: any) {
    // `scope` is going to be moved into wherever the compressor is
    // right now. Update the required scopes' information

    if (scope.parent_scope === this) return

    scope.parent_scope = this
    scope._var_name_cache = null
    if (scope._added_var_names) {
      scope._added_var_names.forEach(name => scope.add_var_name(name))
    }

    // TODO uses_with, uses_eval, etc

    const new_scope_enclosed_set = new Set(scope.enclosed)
    const scope_ancestry = (() => {
      const ancestry: any[] = []
      let cur = this
      do {
        ancestry.push(cur)
      } while ((cur = cur.parent_scope))
      ancestry.reverse()
      return ancestry
    })()

    const to_enclose: any[] = []
    for (const scope_topdown of scope_ancestry) {
      to_enclose.forEach(e => push_uniq(scope_topdown.enclosed, e))
      for (const def of scope_topdown.variables.values()) {
        if (new_scope_enclosed_set.has(def)) {
          push_uniq(to_enclose, def)
          push_uniq(scope_topdown.enclosed, def)
        }
      }
    }
  }

  is_block_scope = function () {
    return this._block_scope || false
  }

  find_variable (name: any | string) {
    if (name?.isAst?.('AST_Symbol')) name = name.name
    return this.variables.get(name) ||
          (this.parent_scope && this.parent_scope.find_variable(name))
  }

  def_function (this: any, symbol: any, init: boolean) {
    var def = this.def_variable(symbol, init)
    if (!def.init || def.init?.isAst?.('AST_Defun')) def.init = init
    this.functions.set(symbol.name, def)
    return def
  }

  def_variable (symbol: any, init?: boolean) {
    var def = this.variables.get(symbol.name)
    if (def) {
      def.orig.push(symbol)
      if (def.init && (def.scope !== symbol.scope || def.init?.isAst?.('AST_Function'))) {
        def.init = init
      }
    } else {
      def = new SymbolDef(this, symbol, init)
      this.variables.set(symbol.name, def)
      def.global = !this.parent_scope
    }
    return symbol.thedef = def
  }

  next_mangled (options: any, def: any) {
    return next_mangled(this, options)
  }

  get_defun_scope () {
    var self = this
    while (self.is_block_scope()) {
      self = self.parent_scope
    }
    return self
  }

  clone = function (deep: boolean) {
    var node = this._clone(deep)
    if (this.variables) node.variables = new Map(this.variables)
    if (this.functions) node.functions = new Map(this.functions)
    if (this.enclosed) node.enclosed = this.enclosed.slice()
    if (this._block_scope) node._block_scope = this._block_scope
    return node
  }

  pinned () {
    return this.uses_eval || this.uses_with
  }

  figure_out_scope (options: any, data: any = {}) {
    options = defaults(options, {
      cache: null,
      ie8: false,
      safari10: false
    })

    const { parent_scope = null, toplevel = this } = data

    if (!(toplevel?.isAst?.('AST_Toplevel'))) {
      throw new Error('Invalid toplevel scope')
    }

    // pass 1: setup scope chaining and handle definitions
    var scope: any = this.parent_scope = parent_scope
    var labels = new Map()
    var defun: any = null
    var in_destructuring: any = null
    var for_scopes: any[] = []
    var tw = new TreeWalker((node, descend) => {
      if (node.is_block_scope()) {
        const save_scope = scope
        node.block_scope = scope = new AST_Scope(node)
        scope._block_scope = true
        // AST_Try in the AST sadly *is* (not has) a body itself,
        // and its catch and finally branches are children of the AST_Try itself
        const parent_scope = node?.isAst?.('AST_Catch')
          ? save_scope.parent_scope
          : save_scope
        scope.init_scope_vars(parent_scope)
        scope.uses_with = save_scope.uses_with
        scope.uses_eval = save_scope.uses_eval
        if (options.safari10) {
          if (node?.isAst?.('AST_For') || node?.isAst?.('AST_ForIn')) {
            for_scopes.push(scope)
          }
        }

        if (node?.isAst?.('AST_Switch')) {
          // XXX: HACK! Ensure the switch expression gets the correct scope (the parent scope) and the body gets the contained scope
          // AST_Switch has a scope within the body, but it itself "is a block scope"
          // This means the switched expression has to belong to the outer scope
          // while the body inside belongs to the switch itself.
          // This is pretty nasty and warrants an AST change similar to AST_Try (read above)
          const the_block_scope = scope
          scope = save_scope
          node.expression.walk(tw)
          scope = the_block_scope
          for (let i = 0; i < node.body.length; i++) {
            node.body[i].walk(tw)
          }
        } else {
          descend()
        }
        scope = save_scope
        return true
      }
      if (node?.isAst?.('AST_Destructuring')) {
        const save_destructuring = in_destructuring
        in_destructuring = node
        descend()
        in_destructuring = save_destructuring
        return true
      }
      if (node?.isAst?.('AST_Scope')) {
                node.init_scope_vars?.(scope)
                var save_scope = scope
                var save_defun = defun
                var save_labels = labels
                defun = scope = node
                labels = new Map()
                descend()
                scope = save_scope
                defun = save_defun
                labels = save_labels
                return true // don't descend again in TreeWalker
      }
      if (node?.isAst?.('AST_LabeledStatement')) {
        var l = node.label
        if (labels.has(l.name)) {
          throw new Error(string_template('Label {name} defined twice', l))
        }
        labels.set(l.name, l)
        descend()
        labels.delete(l.name)
        return true // no descend again
      }
      if (node?.isAst?.('AST_With')) {
        for (var s: any | null = scope; s; s = s.parent_scope) { s.uses_with = true }
        return
      }
      if (node?.isAst?.('AST_Symbol')) {
        node.scope = scope
      }
      if (node?.isAst?.('AST_Label')) {
        // TODO: check type
        node.thedef = node
        node.references = [] as any
      }
      if (node?.isAst?.('AST_SymbolLambda')) {
        defun.def_function(node, node.name == 'arguments' ? undefined : defun)
      } else if (node?.isAst?.('AST_SymbolDefun')) {
        // Careful here, the scope where this should be defined is
        // the parent scope.  The reason is that we enter a new
        // scope when we encounter the AST_Defun node (which is
        // ?.isAst?.('AST_Scope')) but we get to the symbol a bit
        // later.
        mark_export((node.scope = defun.parent_scope.get_defun_scope()).def_function(node, defun), 1)
      } else if (node?.isAst?.('AST_SymbolClass')) {
        mark_export(defun.def_variable(node, defun), 1)
      } else if (node?.isAst?.('AST_SymbolImport')) {
        scope.def_variable(node)
      } else if (node?.isAst?.('AST_SymbolDefClass')) {
        // This deals with the name of the class being available
        // inside the class.
        mark_export((node.scope = defun.parent_scope).def_function(node, defun), 1)
      } else if (
        node?.isAst?.('AST_SymbolVar') ||
                node?.isAst?.('AST_SymbolLet') ||
                node?.isAst?.('AST_SymbolConst') ||
                node?.isAst?.('AST_SymbolCatch')
      ) {
        var def: any
        if (node?.isAst?.('AST_SymbolBlockDeclaration')) {
          def = scope.def_variable(node, null)
        } else {
          def = defun.def_variable(node, node.TYPE == 'SymbolVar' ? null : undefined)
        }
        if (!def.orig.every((sym) => {
          if (sym === node) return true
          if (node?.isAst?.('AST_SymbolBlockDeclaration')) {
            return sym?.isAst?.('AST_SymbolLambda')
          }
          return !(sym?.isAst?.('AST_SymbolLet') || sym?.isAst?.('AST_SymbolConst'))
        })) {
          js_error(
                        `"${node.name}" is redeclared`,
                        node.start.file,
                        node.start.line,
                        node.start.col,
                        node.start.pos
          )
        }
        if (!(node?.isAst?.('AST_SymbolFunarg'))) mark_export(def, 2)
        if (defun !== scope) {
          node.mark_enclosed()
          const def = scope.find_variable(node)
          if (node.thedef !== def) {
            node.thedef = def
            node.reference()
          }
        }
      } else if (node?.isAst?.('AST_LabelRef')) {
        var sym = labels.get(node.name)
        if (!sym) {
          throw new Error(string_template('Undefined label {name} [{line},{col}]', {
            name: node.name,
            line: node.start.line,
            col: node.start.col
          }))
        }
        node.thedef = sym
      }
      if (!(scope?.isAst?.('AST_Toplevel')) && (node?.isAst?.('AST_Export') || node?.isAst?.('AST_Import'))) {
        js_error(
                    `"${node.TYPE}" statement may only appear at the top level`,
                    node.start.file,
                    node.start.line,
                    node.start.col,
                    node.start.pos
        )
      }
    })
    this.walk(tw)

    function mark_export (def: any, level: number) {
      if (in_destructuring) {
        var i = 0
        do {
          level++
        } while (tw.parent(i++) !== in_destructuring)
      }
      var node = tw.parent(level)
      if (def.export = node?.isAst?.('AST_Export') ? MASK_EXPORT_DONT_MANGLE : 0) {
        var exported = node.exported_definition
        if ((exported?.isAst?.('AST_Defun') || exported?.isAst?.('AST_DefClass')) && node.is_default) {
          def.export = MASK_EXPORT_WANT_MANGLE
        }
      }
    }

    // pass 2: find back references and eval
    const is_toplevel = this?.isAst?.('AST_Toplevel')
    if (is_toplevel) {
      this.globals = new Map()
    }

    var tw = new TreeWalker((node: any) => {
      if (node?.isAst?.('AST_LoopControl') && node.label) {
        node.label.thedef.references.push(node) // TODO: check type
        return true
      }
      if (node?.isAst?.('AST_SymbolRef')) {
        var name = node.name
        if (name == 'eval' && tw.parent()?.isAst?.('AST_Call')) {
          for (var s: any = node.scope; s && !s.uses_eval; s = s.parent_scope) {
            s.uses_eval = true
          }
        }
        var sym
        if (tw.parent()?.isAst?.('AST_NameMapping') && tw.parent(1).module_name ||
                    !(sym = node.scope.find_variable(name))) {
          sym = toplevel.def_global?.(node)
          if (node?.isAst?.('AST_SymbolExport')) sym.export = MASK_EXPORT_DONT_MANGLE
        } else if (sym.scope?.isAst?.('AST_Lambda') && name == 'arguments') {
          sym.scope.uses_arguments = true
        }
        node.thedef = sym
        node.reference()
        if (node.scope.is_block_scope() &&
                    !(sym.orig[0]?.isAst?.('AST_SymbolBlockDeclaration'))) {
          node.scope = node.scope.get_defun_scope()
        }
        return true
      }
      // ensure mangling works if catch reuses a scope variable
      var def
      if (node?.isAst?.('AST_SymbolCatch') && (def = redefined_catch_def(node.definition()))) {
        let s: any = node.scope
        while (s) {
          push_uniq(s.enclosed, def)
          if (s === def.scope) break
          s = s.parent_scope
        }
      }
    })
    this.walk(tw)

    // pass 3: work around IE8 and Safari catch scope bugs
    if (options.ie8 || options.safari10) {
      walk(this, (node: any) => {
        if (node?.isAst?.('AST_SymbolCatch')) {
          var name = node.name
          var refs = node.thedef.references
          var scope = node.scope.get_defun_scope()
          var def = scope.find_variable(name) ||
                        toplevel.globals.get(name) ||
                        scope.def_variable(node)
          refs.forEach(function (ref) {
            ref.thedef = def
            ref.reference()
          })
          node.thedef = def
          node.reference()
          return true
        }
      })
    }

    // pass 4: add symbol definitions to loop scopes
    // Safari/Webkit bug workaround - loop init let variable shadowing argument.
    // https://github.com/mishoo/UglifyJS2/issues/1753
    // https://bugs.webkit.org/show_bug.cgi?id=171041
    if (options.safari10) {
      for (const scope of for_scopes) {
                scope.parent_scope?.variables.forEach(function (def) {
                  push_uniq(scope.enclosed, def)
                })
      }
    }
  }

  static documentation = 'Base class for all statements introducing a lexical scope'
  static propdoc = {
    variables: '[Map/S] a map of name -> SymbolDef for all variables/functions defined in this scope',
    functions: '[Map/S] like `variables`, but only lists function declarations',
    uses_with: '[boolean/S] tells whether this scope uses the `with` statement',
    uses_eval: '[boolean/S] tells whether this scope contains a direct call to the global `eval`',
    parent_scope: '[AST_Scope?/S] link to the parent scope',
    enclosed: '[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes',
    cname: '[integer/S] current index for mangling variables (used internally by the mangler)'
  } as any

  static PROPS = AST_Block.PROPS.concat(['variables', 'functions', 'uses_with', 'uses_eval', 'parent_scope', 'enclosed', 'cname', '_var_name_cache'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.variables = args.variables
    this.functions = args.functions
    this.uses_with = args.uses_with
    this.uses_eval = args.uses_eval
    this.parent_scope = args.parent_scope
    this.enclosed = args.enclosed
    this.cname = args.cname
    this._var_name_cache = args._var_name_cache
  }
}