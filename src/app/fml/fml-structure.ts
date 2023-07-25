import {group, isDefined, isNil} from '@kodality-web/core-util';
import {ElementDefinition, StructureMap} from 'fhir/r5';
import {FMLRuleParser, FMLRuleParserVariables} from './rule-parsers/parser';
import {FMLCopyParser} from './rule-parsers/copy.parser';
import {FMLCreateParser} from './rule-parsers/create.parser';
import {FMLUuidParser} from './rule-parsers/uuid.parser';
import {FMLAppendParser} from './rule-parsers/append.parser';

export interface FMLStructureObjectField {
  name: string;
  types: string[];
}


/**
 * Represents the ElementDefinition with the externally set fields.
 */
export class FMLStructureObject {
  resource: string;
  name: string;
  fields: FMLStructureObjectField[] = [];
  mode: 'source' | 'target' | 'object' | string;
  _fhirDefinition?: ElementDefinition;

  html(): string {
    return `
      <div>
         <h5 class="node-title">${this.mode} | ${this.name !== this.resource ? `<b>${this.name}</b> | ` : ''} ${this.resource}</div>
         ${this.fields.map(f => `<div style="height: 1.5rem; border-bottom: 1px solid var(--color-borders)">${f.name}</div>`).join('')}
      </div>
    `
  };

  getFieldIndex(field: string): number {
    return this.fields.findIndex(f => f.name === field);
  }
}

export class FMLStructureRule {
  name: string;
  alias?: string; // aka. variable
  action: string;
  parameters?: any[];

  sourceObject: string;
  sourceField: string;
  targetObject: string;
  targetField: string;

  html: () => string
}

export class FMLStructure {
  objects: {[name: string]: FMLStructureObject} = {};
  rules: FMLStructureRule[] = []


  public static map(fhir: StructureMap): FMLStructure {
    const ruleParsers: FMLRuleParser[] = [
      new FMLCopyParser(),
      new FMLCreateParser(),
      new FMLUuidParser(),
      new FMLAppendParser(),
    ]


    const struc = new FMLStructure();
    struc.objects = group(fhir.structure ?? [], s => s.url.substring(s.url.lastIndexOf('/') + 1), s => {
      const obj = new FMLStructureObject()
      const resource = s.url.substring(s.url.lastIndexOf('/') + 1);
      obj.resource = resource
      obj.name = resource;
      obj.mode = s.mode
      return obj
    })


    // group
    fhir.group.forEach(fhirGroup => {
      const _parseRule = (fhirRule, variables: FMLRuleParserVariables) => {
        fhirRule.source.filter(frt => isDefined(frt.variable)).forEach(fhirRuleSource => {
          variables[fhirRuleSource.variable] = `${variables[fhirRuleSource.context]}.${fhirRuleSource.element}`;
        })
        fhirRule.target.filter(frt => isDefined(frt.variable)).forEach(fhirRuleTarget => {
          variables[fhirRuleTarget.variable] = `${variables[fhirRuleTarget.context]}.${fhirRuleTarget.element}`;
        })


        // NB: currently only one source
        const fhirRuleSource = fhirRule.source[0]

        fhirRule.target.forEach(fhirRuleTarget => {
          const parser = ruleParsers.find(p => p.action === fhirRuleTarget.transform)
          if (isNil(parser)) {
            console.warn(`Parser for the "${fhirRuleTarget.transform}" transformation not found!`)
            return
          }

          const {rule, object} = parser.parse(fhirRule.name, fhirRuleSource, fhirRuleTarget, variables)
          if (isDefined(rule)) {
            struc.rules.push(rule)
          }
          if (isDefined(object)) {
            struc.objects[object.name] = object;
          }
        })

        fhirRule.rule?.forEach(subRule => {
          _parseRule(subRule, variables)
        })
      }


      fhirGroup.rule.forEach(fhirRule => {
        // init variables
        const variables = group(fhirGroup.input, i => i.name, i => i.type);
        _parseRule(fhirRule, variables)

        console.log(variables)
      })
    })

    console.log(struc)
    return struc
  }
}
