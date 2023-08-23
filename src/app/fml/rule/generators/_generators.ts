import {FMLCopyRuleGenerator} from './copy.generator';
import {FMLRuleGenerator} from './generator';
import {FMLDefaultRuleGenerator} from './default.generator';
import {FMLConstantRuleGenerator} from './constant.generator';

export const RULE_GENERATORS = [
  new FMLConstantRuleGenerator(),
  new FMLCopyRuleGenerator(),
  new FMLDefaultRuleGenerator(),
];

export function getRuleGenerator(action: string): FMLRuleGenerator {
  const _find = (a): FMLRuleGenerator => RULE_GENERATORS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
