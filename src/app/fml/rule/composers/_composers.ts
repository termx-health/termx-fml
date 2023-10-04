import {FMLCopyRuleComposer} from './copy.composer';
import {FMLRuleComposer} from './composer';
import {FMLDefaultRuleComposer} from './default.composer';
import {FMLConstantRuleComposer} from './constant.composer';
import {FMLRulegroupRuleComposer} from './rulegroup.composer';
import {FMLTranslateRuleComposer} from './translate.composer';
import {FMLAppendRuleComposer} from './append.composer';

export const RULE_COMPOSERS = [
  new FMLAppendRuleComposer(),
  new FMLConstantRuleComposer(),
  new FMLCopyRuleComposer(),
  new FMLDefaultRuleComposer(),
  new FMLRulegroupRuleComposer(),
  new FMLTranslateRuleComposer(),
];

export function getRuleComposer(action: string): FMLRuleComposer {
  const _find = (a): FMLRuleComposer => RULE_COMPOSERS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
