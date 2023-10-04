import {Component, inject, OnInit} from '@angular/core';
import {EditorContext} from '../context/editor.context';
import {Bundle, StructureDefinition, StructureMap, StructureMapGroupRule} from 'fhir/r5';
import {duplicate, group, isNil} from '@kodality-web/core-util';
import {combineLatest} from 'rxjs';
import {$THIS, FMLStructure} from '../fml/fml-structure';
import {FmlStructureParser} from '../fml/fml-structure-parser';
import {Location} from '@angular/common';


/*
 * THIS IS EXPERIMENTAL COMPONENT!
 * FOLLOWING CODE IS NOT USED FOR ANY VALIDATION ELSEWHERE.
 * IT MAY BE DELETED AT ANY TIME.
 */

const bundleMap = (bundle: Bundle<StructureDefinition>): Record<string, StructureDefinition> => {
  return group(bundle.entry, e => e.resource.url, e => e.resource);
};

const traverseRules = (rules: StructureMapGroupRule[], cb: (r: StructureMapGroupRule) => void): void => {
  rules?.forEach(r => {
    cb(r);
    traverseRules(r.rule, cb);
  });
};

interface RuleValidationResult {
  name: string,
  description?: string,
  status: 'error' | 'success',
  details?: string
}

const RULES: ((map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => RuleValidationResult | RuleValidationResult[])[] = [
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const ruleNames = [];
    map.group.forEach(g => traverseRules(g.rule, r => ruleNames.push(r.name)));

    const invalidRuleNames = ruleNames.filter(n => n.includes('#'));
    return {
      name: 'Rule Names',
      ...(invalidRuleNames.length ? {
          status: 'error',
          description: 'Rule names should contain valid symbols',
          details: invalidRuleNames.join('\n')
        } : {
          status: 'success',
          description: 'Rule names are valid'
        }
      )
    };
  },
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const resources = bundleMap(bundle);
    const missingResources = map.structure.filter(el => !resources[el.url]);
    return {
      name: 'Resource URL(s)',
      ...(missingResources.length ? {
        status: 'error',
        description: 'Resource is missing in the Bundle',
        details: missingResources.map(r => r.url).join('\n')
      } : {
        description: 'The Bundle has every input resource',
        status: 'success'
      })
    };
  },
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const emptyGroups = map.group.filter(g => !g.rule?.length);
    return {
      name: 'Non empty groups',
      ...(emptyGroups.length ? {
        status: 'error',
        description: 'Group is missing rules',
        details: emptyGroups.map(g => g.name).join('\n')
      } : {
        status: 'success',
        description: 'Groups contain at least 1 rule',
      })
    }
      ;
  },
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const isNameMissing = map.name === 'null' || isNil(map.name);
    return {
      name: 'Structure Map name',
      ...(isNameMissing ? {
        status: 'error',
        description: 'The name is missing',
      } : {
        status: 'success',
        description: 'The name is set',
      })
    };
  },
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const ruleNames = [];
    map.group.forEach(g => traverseRules(g.rule, r => ruleNames.push(r.name)));

    const duplicates = ruleNames.filter(duplicate);
    return {
      name: 'Duplicate rule names',
      ...(duplicates.length ? {
        status: 'error',
        description: 'Structure Map has duplicate rules',
        details: duplicates.join(", ")
      } : {
        status: 'success',
        description: 'Rules have unique names',
      })
    };
  },
  (map: StructureMap, bundle: Bundle<StructureDefinition>, fml: FMLStructure) => {
    const mismatchTypeConnections: string[] = [];
    fml.groups.forEach(g => {
      g.connections.forEach(con => {
        const s = g.objects[con.sourceObject]?.fields?.[con.sourceFieldIdx];
        const t = g.objects[con.targetObject]?.fields?.[con.targetFieldIdx];

        if (con.sourceFieldIdx && con.targetFieldIdx && t && s?.types?.[0] !== t?.types?.[0]) {
          if (s.name === $THIS || t.name === $THIS) {
            return;
          }
          mismatchTypeConnections.push(`${con.sourceObject}.${s.name} != ${con.targetObject}.${t.name}`);
        }
      });
    });

    return {
      name: 'Mismatched type',
      ...(mismatchTypeConnections.length ? {
        status: 'error',
        description: 'Has mismatched types',
        details: mismatchTypeConnections.join(', ')
      } : {
        status: 'success',
        description: 'Types are matched',
      })
    };
  }
];

@Component({
  templateUrl: 'validation.component.html',
  styles: [`
    .wrapper {
      padding: 4rem;
      margin: auto;
      max-width: 1100px;
    }
  `]
})
export class ValidationComponent implements OnInit {
  protected ctx = inject(EditorContext);
  protected location = inject(Location);
  protected rules: RuleValidationResult[] = [];

  public ngOnInit(): void {
    combineLatest([
      this.ctx.structureMap$,
      this.ctx.bundle$,
    ]).subscribe(([map, bundle]) => {
      if (isNil(map) || isNil(bundle)) {
        return;
      }

      const fml = FmlStructureParser.map(bundle, map);
      this.rules = RULES.flatMap(fun => fun(map, bundle, fml));
    });
  }
}
