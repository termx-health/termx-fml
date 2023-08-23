import {FMLRuleParser} from './parser';
import {FMLCopyRuleParser} from './copy.parser';
import {FMLCreateRuleParser} from './create.parser';
import {FMLUuidRuleParser} from './uuid.parser';
import {FMLAppendRuleParser} from './append.parser';
import {FMLDefaultRuleParser} from './default.parser';

export const RULE_PARSERS: FMLRuleParser[] = [
  new FMLAppendRuleParser(),
  new FMLCopyRuleParser(),
  new FMLCreateRuleParser(),
  new FMLDefaultRuleParser(),
  new FMLUuidRuleParser(),
];


export function getRuleParser(action: string): FMLRuleParser {
  const _find = (a): FMLRuleParser => RULE_PARSERS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
