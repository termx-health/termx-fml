import {FMLRuleRenderer} from './renderer';
import {FMLDefaultRuleRenderer} from './default.renderer';
import {FMLAppendRuleRenderer} from './append.renderer';
import {FMLCopyRuleRenderer} from './copy.renderer';
import {FMLCcRuleRenderer} from './cc.renderer';
import {FMLConstantRuleRenderer} from './constant.renderer';
import {FMLEvaluateRuleRenderer} from './evaluate.renderer';
import {FMLTruncateRuleRenderer} from './truncate.renderer';
import {FMLRulegroupRuleRenderer} from './rulegroup.renderer';
import {FMLUuidRuleRenderer} from './uuid.renderer';

export const RULE_RENDERERS = [
  new FMLAppendRuleRenderer(),
  new FMLCcRuleRenderer(),
  new FMLConstantRuleRenderer(),
  new FMLCopyRuleRenderer(),
  new FMLDefaultRuleRenderer(),
  new FMLEvaluateRuleRenderer(),
  new FMLRulegroupRuleRenderer(),
  new FMLTruncateRuleRenderer(),
  new FMLUuidRuleRenderer(),
];

export function getRuleRenderer(action: string): FMLRuleRenderer {
  const _find = (a): FMLRuleRenderer => RULE_RENDERERS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
