import { OutputStream } from '../output'
import AST_Node, { AST_Node_Props } from './node'
import Compressor from '../compressor'
import {
  make_sequence,
  first_in_statement,
  best_of,
  make_node,
  best,
  push,
  pop,
  is_nullish_check,
  to_moz,
  maintain_this_binding, is_ast_sequence, is_ast_true, is_ast_false, is_ast_expansion, is_ast_symbol_ref, is_ast_constant, is_ast_unary_prefix, is_ast_assign, is_ast_call, is_ast_conditional, is_ast_binary
} from '../utils'

import TreeWalker from '../tree-walker'
import TreeTransformer from '../tree-transformer'

export default class AST_Conditional extends AST_Node {
  public alternative: AST_Node
  public consequent: AST_Node
  public condition: AST_Node

  public _prepend_comments_check (node: AST_Node) {
    return this.condition === node
  }

  public addStrings (add: Function) {
    this.consequent?.addStrings(add)
    this.alternative?.addStrings(add)
  }

  protected _in_boolean_context (context: AST_Node): boolean {
    if (this.condition === context) {
      return true
    }
    return false
  }

  protected _in_boolean_context_next (_context: AST_Node): boolean {
    return true
  }

  protected _optimize (compressor: Compressor): any {
    let self: AST_Conditional = this
    if (!compressor.option('conditionals')) return self
    // This looks like lift_sequences(), should probably be under "sequences"
    if (is_ast_sequence(self.condition)) {
      const expressions = self.condition.expressions.slice()
      self.condition = expressions.pop() as any
      expressions.push(self)
      return make_sequence(self, expressions)
    }
    const cond = self.condition.evaluate(compressor)
    if (cond !== self.condition) {
      if (cond) {
        compressor.warn('Condition always true [{file}:{line},{col}]', self.start)
        return maintain_this_binding(compressor.parent(), compressor.self(), self.consequent)
      } else {
        compressor.warn('Condition always false [{file}:{line},{col}]', self.start)
        return maintain_this_binding(compressor.parent(), compressor.self(), self.alternative)
      }
    }
    const negated = cond.negate(compressor, first_in_statement(compressor))
    if (best_of(compressor, cond, negated) === negated) {
      self = make_node('AST_Conditional', self, {
        condition: negated,
        consequent: self.alternative,
        alternative: self.consequent
      }) as AST_Conditional
    }
    const condition = self.condition
    const consequent = self.consequent
    const alternative = self.alternative
    // x?x:y --> x||y
    if (is_ast_symbol_ref(condition) &&
          is_ast_symbol_ref(consequent) &&
          condition.definition?.() === consequent.definition?.()) {
      return make_node('AST_Binary', self, {
        operator: '||',
        left: condition,
        right: alternative
      })
    }
    // if (foo) exp = something; else exp = something_else;
    //                   |
    //                   v
    // exp = foo ? something : something_else;
    if (is_ast_assign(consequent) &&
          is_ast_assign(alternative) &&
          consequent.operator == alternative.operator &&
          consequent.left.equivalent_to(alternative.left) &&
          (!self.condition.has_side_effects(compressor) ||
              (consequent.operator == '=' &&
                  !consequent.left.has_side_effects(compressor)))) {
      return make_node('AST_Assign', self, {
        operator: consequent.operator,
        left: consequent.left,
        right: make_node('AST_Conditional', self, {
          condition: self.condition,
          consequent: consequent.right,
          alternative: alternative.right
        })
      })
    }
    // x ? y(a) : y(b) --> y(x ? a : b)
    let arg_index
    if (is_ast_call(consequent) && is_ast_call(alternative) &&
          alternative.TYPE === consequent.TYPE &&
          consequent.args.length > 0 &&
          consequent.args.length == alternative.args.length &&
          consequent.expression.equivalent_to(alternative.expression) &&
          !self.condition.has_side_effects(compressor) &&
          !consequent.expression.has_side_effects(compressor) &&
          typeof (arg_index = single_arg_diff(consequent.args, alternative.args)) === 'number') {
      const node: any = consequent.clone()
      node.args[arg_index] = make_node('AST_Conditional', self, {
        condition: self.condition,
        consequent: consequent.args[arg_index],
        alternative: alternative.args[arg_index]
      })
      return node
    }
    // a ? b : c ? b : d --> (a || c) ? b : d
    if (is_ast_conditional(alternative) &&
          consequent.equivalent_to(alternative.consequent)) {
      return make_node('AST_Conditional', self, {
        condition: make_node('AST_Binary', self, {
          operator: '||',
          left: condition,
          right: alternative.condition
        }),
        consequent: consequent,
        alternative: alternative.alternative
      }).optimize(compressor)
    }

    // a == null ? b : a -> a ?? b
    if (
      compressor.option('ecma') >= 2020 &&
          is_nullish_check(condition, alternative, compressor)
    ) {
      return make_node('AST_Binary', self, {
        operator: '??',
        left: alternative,
        right: consequent
      }).optimize(compressor)
    }

    // a ? b : (c, b) --> (a || c), b
    if (is_ast_sequence(alternative) &&
          consequent.equivalent_to(alternative.expressions[alternative.expressions.length - 1])) {
      return make_sequence(self, [
        make_node('AST_Binary', self, {
          operator: '||',
          left: condition,
          right: make_sequence(self, alternative.expressions.slice(0, -1))
        }),
        consequent
      ]).optimize(compressor)
    }
    // a ? b : (c && b) --> (a || c) && b
    if (is_ast_binary(alternative) &&
          alternative.operator == '&&' &&
          consequent.equivalent_to(alternative.right)) {
      return make_node('AST_Binary', self, {
        operator: '&&',
        left: make_node('AST_Binary', self, {
          operator: '||',
          left: condition,
          right: alternative.left
        }),
        right: consequent
      }).optimize(compressor)
    }
    // x?y?z:a:a --> x&&y?z:a
    if (is_ast_conditional(consequent) &&
          consequent.alternative.equivalent_to(alternative)) {
      return make_node('AST_Conditional', self, {
        condition: make_node('AST_Binary', self, {
          left: self.condition,
          operator: '&&',
          right: consequent.condition
        }),
        consequent: consequent.consequent,
        alternative: alternative
      })
    }
    // x ? y : y --> x, y
    if (consequent.equivalent_to(alternative)) {
      return make_sequence(self, [
        self.condition,
        consequent
      ]).optimize(compressor)
    }
    // x ? y || z : z --> x && y || z
    if (is_ast_binary(consequent) &&
          consequent.operator == '||' &&
          consequent.right.equivalent_to(alternative)) {
      return make_node('AST_Binary', self, {
        operator: '||',
        left: make_node('AST_Binary', self, {
          operator: '&&',
          left: self.condition,
          right: consequent.left
        }),
        right: alternative
      }).optimize(compressor)
    }
    const in_bool = compressor.in_boolean_context()
    if (is_true(self.consequent)) {
      if (is_false(self.alternative)) {
        // c ? true : false ---> !!c
        return booleanize(self.condition)
      }
      // c ? true : x ---> !!c || x
      return make_node('AST_Binary', self, {
        operator: '||',
        left: booleanize(self.condition),
        right: self.alternative
      })
    }
    if (is_false(self.consequent)) {
      if (is_true(self.alternative)) {
        // c ? false : true ---> !c
        return booleanize(self.condition.negate(compressor))
      }
      // c ? false : x ---> !c && x
      return make_node('AST_Binary', self, {
        operator: '&&',
        left: booleanize(self.condition.negate(compressor)),
        right: self.alternative
      })
    }
    if (is_true(self.alternative)) {
      // c ? x : true ---> !c || x
      return make_node('AST_Binary', self, {
        operator: '||',
        left: booleanize(self.condition.negate(compressor)),
        right: self.consequent
      })
    }
    if (is_false(self.alternative)) {
      // c ? x : false ---> !!c && x
      return make_node('AST_Binary', self, {
        operator: '&&',
        left: booleanize(self.condition),
        right: self.consequent
      })
    }

    return self

    function booleanize (node: AST_Node) {
      if (node.is_boolean()) return node
      // !!expression
      return make_node('AST_UnaryPrefix', node, {
        operator: '!',
        expression: node.negate(compressor)
      })
    }

    // AST_True or !0
    function is_true (node: AST_Node) {
      return is_ast_true(node) ||
              (in_bool &&
                  is_ast_constant(node) &&
                  node.getValue()) ||
              (is_ast_unary_prefix(node) &&
                  node.operator == '!' &&
                  is_ast_constant(node.expression) &&
                  !node.expression.getValue())
    }
    // AST_False or !1
    function is_false (node: AST_Node) {
      return is_ast_false(node) ||
              (in_bool &&
                  is_ast_constant(node) &&
                  !node.getValue()) ||
              (is_ast_unary_prefix(node) &&
                  node.operator == '!' &&
                  is_ast_constant(node.expression) &&
                  node.expression.getValue())
    }

    function single_arg_diff (a: any[], b: any[]) {
      for (let i = 0, len = a.length; i < len; i++) {
        if (is_ast_expansion(a[i])) return
        if (!a[i].equivalent_to(b[i])) {
          if (is_ast_expansion(b[i])) return
          for (let j = i + 1; j < len; j++) {
            if (is_ast_expansion(a[j])) return
            if (!a[j].equivalent_to(b[j])) return
          }
          return i
        }
      }
      return undefined
    }
  }

  public drop_side_effect_free (compressor: Compressor): any {
    const consequent = this.consequent.drop_side_effect_free(compressor)
    const alternative = this.alternative.drop_side_effect_free(compressor)
    if (consequent === this.consequent && alternative === this.alternative) return this
    if (!consequent) {
      return alternative ? make_node('AST_Binary', this, {
        operator: '||',
        left: this.condition,
        right: alternative
      }) : this.condition.drop_side_effect_free(compressor)
    }
    if (!alternative) {
      return make_node('AST_Binary', this, {
        operator: '&&',
        left: this.condition,
        right: consequent
      })
    }
    const node = this.clone() as AST_Conditional
    node.consequent = consequent
    node.alternative = alternative
    return node
  }

  public may_throw (compressor: Compressor) {
    return this.condition.may_throw(compressor) ||
          this.consequent.may_throw(compressor) ||
          this.alternative.may_throw(compressor)
  }

  public has_side_effects (compressor: Compressor) {
    return this.condition.has_side_effects(compressor) ||
          this.consequent.has_side_effects(compressor) ||
          this.alternative.has_side_effects(compressor)
  }

  public _eval (compressor: Compressor, depth: number) {
    const condition = this.condition._eval(compressor, depth)
    if (condition === this.condition) return this
    const node = condition ? this.consequent : this.alternative
    const value = node._eval(compressor, depth)
    return value === node ? this : value
  }

  public negate (compressor: Compressor, first_in_statement: Function | boolean): AST_Conditional {
    const self = this.clone() as AST_Conditional
    self.consequent = self.consequent.negate(compressor)
    self.alternative = self.alternative.negate(compressor)
    return best(this, self, first_in_statement) as AST_Conditional
  }

  public is_string (compressor: Compressor) {
    return this.consequent.is_string(compressor) && this.alternative.is_string(compressor)
  }

  public is_number (compressor: Compressor) {
    return this.consequent.is_number(compressor) && this.alternative.is_number(compressor)
  }

  public is_boolean () {
    return this.consequent.is_boolean() && this.alternative.is_boolean()
  }

  public reduce_vars (tw: TreeWalker) {
    this.condition.walk(tw)
    push(tw)
    this.consequent.walk(tw)
    pop(tw)
    push(tw)
    this.alternative.walk(tw)
    pop(tw)
    return true
  }

  public _dot_throw (compressor: Compressor) {
    return this.consequent._dot_throw(compressor) ||
          this.alternative._dot_throw(compressor)
  }

  protected walkInner () {
    const result: AST_Node[] = []
    result.push(this.condition)
    result.push(this.consequent)
    result.push(this.alternative)
    return result
  }

  public _children_backwards (push: Function) {
    push(this.alternative)
    push(this.consequent)
    push(this.condition)
  }

  public _size = () => 3
  public shallow_cmp_props: any = {}
  protected _transform (tw: TreeTransformer) {
    this.condition = this.condition.transform(tw)
    this.consequent = this.consequent.transform(tw)
    this.alternative = this.alternative.transform(tw)
  }

  public _to_mozilla_ast (_parent: AST_Node): any {
    return {
      type: 'ConditionalExpression',
      test: to_moz(this.condition),
      consequent: to_moz(this.consequent),
      alternate: to_moz(this.alternative)
    }
  }

  public needs_parens = this.needsParens
  protected _codegen (output: OutputStream) {
    this.condition.print(output)
    output.space()
    output.print('?')
    output.space()
    this.consequent.print(output)
    output.space()
    output.colon()
    this.alternative.print(output)
  }

  public static documentation = 'Conditional expression using the ternary operator, i.e. `a ? b : c`'
  public static propdoc ={
    condition: '[AST_Node]',
    consequent: '[AST_Node]',
    alternative: '[AST_Node]'
  }

  public static PROPS =AST_Node.PROPS.concat(['condition', 'consequent', 'alternative'])
  public constructor (args: AST_Conditional_Props) {
    super(args)
    this.condition = args.condition
    this.consequent = args.consequent
    this.alternative = args.alternative
  }
}

export interface AST_Conditional_Props extends AST_Node_Props {
  condition: AST_Node
  consequent: AST_Node
  alternative: AST_Node
}
