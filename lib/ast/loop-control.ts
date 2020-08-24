import { OutputStream } from '../output'
import AST_Jump from './jump'
import { pass_through } from '../utils'
import TreeWalker from '../tree-walker'

export default class AST_LoopControl extends AST_Jump {
  label: any
  _walk (visitor: TreeWalker) {
    return visitor._visit(this, this.label && function (this) {
      this.label._walk(visitor)
    })
  }

  _children_backwards (push: Function) {
    if (this.label) push(this.label)
  }

  shallow_cmp = pass_through
  _transform (self, tw: TreeWalker) {
    if (self.label) self.label = self.label.transform(tw)
  }

  _do_print (output: OutputStream, kind: string) {
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

  static PROPS = AST_Jump.PROPS.concat(['label'])
  constructor (args?) { // eslint-disable-line
    super(args)
    this.label = args.label
  }
}
