import AST_Jump from './jump'
import { pass_through } from '../utils'

export default class AST_LoopControl extends AST_Jump {
  label: any
  _walk (visitor: any) {
    return visitor._visit(this, this.label && function () {
      this.label._walk(visitor)
    })
  }

  _children_backwards (push: Function) {
    if (this.label) push(this.label)
  }

  shallow_cmp = pass_through
  _transform (self, tw: any) {
    if (self.label) self.label = self.label.transform(tw)
  }

  _do_print (output: any, kind: string) {
    output.print(kind)
    if (this.label) {
      output.space()
      this.label.print(output)
    }
    output.semicolon()
  }

  static documentation = 'Base class for loop control statements (`break` and `continue`)'
  static propdoc = {
    label: '[AST_LabelRef?] the label, or null if none'
  }

  TYPE = 'LoopControl'
  static PROPS = AST_Jump.PROPS.concat(['label'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.label = args.label
  }
}