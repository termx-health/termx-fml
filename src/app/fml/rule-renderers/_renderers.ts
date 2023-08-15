import {FMLRuleRenderer} from './renderer';
import {FMLDefaultRuleRenderer} from './default.renderer';
import {FMLAppendRuleRenderer} from './append.renderer';
import {FMLCopyRuleRenderer} from './copy.renderer';
import {FMLCcRuleRenderer} from './cc.renderer';
import {FMLConstantRuleRenderer} from './constant.renderer';
import {FMLEvaluateRuleRenderer} from './evaluate.renderer';

export const RULE_RENDERERS = [
  new FMLAppendRuleRenderer(),
  new FMLCcRuleRenderer(),
  new FMLConstantRuleRenderer(),
  new FMLCopyRuleRenderer(),
  new FMLDefaultRuleRenderer(),
  new FMLEvaluateRuleRenderer(),
];

export function getRuleRenderer(action: string): FMLRuleRenderer {
  const _find = (a): FMLRuleRenderer => RULE_RENDERERS.find(rr => rr.action === a);
  return _find(action) ?? _find('default');
}
