import {FMLCopyRuleComposer} from './copy.composer';
import {FMLRuleComposer} from './composer';
import {FMLDefaultRuleComposer} from './default.composer';
import {FMLConstantRuleComposer} from './constant.composer';

export const RULE_COMPOSERS = [
  new FMLConstantRuleComposer(),
  new FMLCopyRuleComposer(),
  new FMLDefaultRuleComposer(),
];

export function getRuleComposer(action: string): FMLRuleComposer {
  const _find = (a): FMLRuleComposer => RULE_COMPOSERS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
