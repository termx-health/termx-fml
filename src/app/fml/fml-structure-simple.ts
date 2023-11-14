import {group} from '@kodality-web/core-util';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {FMLStructure, FMLStructureConceptMap, FMLStructureConnection, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {plainToInstance} from 'class-transformer';

/*
* Lightweight version of FMLStructure.
* Should be used in mapper and composer only.
*/

export interface FMLStructureSimple {
  objects: {[name: string]: Omit<FMLStructureObject, 'rawFields'>},
  rules: FMLStructureRule[],
  connections: FMLStructureConnection[],
  shareContext: boolean,
  notation: string
}

export interface FMLStructureExportSimple {
  groups: {[groupName: string]: FMLStructureSimple};
  conceptMaps: FMLStructureConceptMap[];
  version: '1.5';
}

export class FMLStructureSimpleMapper {
  public static toFML(bundle: Bundle<StructureDefinition>, exp: FMLStructureExportSimple): FMLStructure {
    const fml = new FMLStructure();
    fml.bundle = bundle;
    fml.conceptMaps = exp.conceptMaps ?? [];
    fml.mainGroupName = Object.keys(exp.groups)[0];

    Object.keys(exp.groups).forEach(groupName => {
      const fmlGroup = new FMLStructureGroup(groupName, () => fml.bundle);
      fml.setGroup(fmlGroup);

      const _fmlGroup = exp.groups[groupName];
      Object.keys(_fmlGroup.objects).forEach(k => {
        return fmlGroup.objects[k] = plainToInstance(FMLStructureObject, {
          ..._fmlGroup.objects[k],
          rawFields: _fmlGroup.objects[k].fields
        });
      });
      fmlGroup.rules = plainToInstance(FMLStructureRule, _fmlGroup.rules);
      fmlGroup._connections = plainToInstance(FMLStructureConnection, _fmlGroup.connections);
      fmlGroup.shareContext = _fmlGroup.shareContext;
      fmlGroup.notation = _fmlGroup.notation as any;
    });

    return fml;
  }

  public static fromFML(fml: FMLStructure): FMLStructureExportSimple {
    return {
      groups: group(fml.groups, g => g.name, fmlGroup => {
        const simpleObjects = Object.values(fmlGroup.objects).map(o => ({
          ...o,
          fields: o.rawFields,
          rawFields: undefined
        }));

        return <FMLStructureSimple>{
          objects: group(simpleObjects, o => o.name),
          rules: fmlGroup.rules,
          connections: fmlGroup.connections,
          shareContext: fmlGroup.shareContext,
          notation: fmlGroup.notation
        };
      }),
      conceptMaps: fml.conceptMaps,
      version: '1.5'
    };
  }
}
