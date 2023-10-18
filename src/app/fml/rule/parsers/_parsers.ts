import {FMLRuleParser} from './parser';
import {FMLCopyRuleParser} from './copy.parser';
import {FMLCreateRuleParser} from './create.parser';
import {FMLAppendRuleParser} from './append.parser';
import {FMLDefaultRuleParser} from './default.parser';
import {FMLEvaluateRuleParser} from './evaluate.parser';

export const RULE_PARSERS: FMLRuleParser[] = [
  new FMLAppendRuleParser(),
  new FMLCopyRuleParser(),
  new FMLCreateRuleParser(),
  new FMLDefaultRuleParser(),
  new FMLEvaluateRuleParser(),
];

const _parser = (a: string): FMLRuleParser => RULE_PARSERS.find(rr => rr.action === a);


export function getRuleParser(action: string): FMLRuleParser {
  return _parser(action) ?? _parser('default');
}
