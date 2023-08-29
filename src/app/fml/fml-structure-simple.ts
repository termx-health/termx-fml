import {group} from '@kodality-web/core-util';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {FMLStructure, FMLStructureConceptMap, FMLStructureConnection, FMLStructureGroup, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {plainToInstance} from 'class-transformer';

export interface FMLStructureSimple {
  objects: {[name: string]: Omit<FMLStructureObject, 'rawFields'>},
  rules: FMLStructureRule[],
  connections: FMLStructureConnection[],
}

export interface FMLStructureExportSimple {
  groups: {[groupName: string]: FMLStructureSimple};
  maps: FMLStructureConceptMap[];
  version: '1';
}

export class FMLStructureSimpleMapper {
  public static toFML(bundle: Bundle<StructureDefinition>, exp: FMLStructureExportSimple): FMLStructure {
    const fml = new FMLStructure();
    fml.bundle = bundle;
    fml.maps = exp.maps ?? [];

    Object.keys(exp.groups).forEach(k => {
      const fmlGroup = new FMLStructureGroup();
      fml.setGroup(fmlGroup, k);

      const _fmlGroup = exp.groups[k];
      Object.keys(_fmlGroup.objects).forEach(k => {
        return fmlGroup.objects[k] = plainToInstance(FMLStructureObject, {
          ..._fmlGroup.objects[k],
          rawFields: _fmlGroup.objects[k].fields
        });
      });
      fmlGroup.rules = plainToInstance(FMLStructureRule, _fmlGroup.rules);
      fmlGroup._connections = plainToInstance(FMLStructureConnection, _fmlGroup.connections);
    });

    return fml;
  }

  public static fromFML(fml: FMLStructure): FMLStructureExportSimple {
    return {
      groups: group(Object.keys(fml.groups), k => k, k => {
        const fmlGroup = fml.groups[k];
        const simpleObjects = Object.values(fmlGroup.objects).map(o => ({
          ...o,
          fields: o.rawFields,
          rawFields: undefined
        }));

        return <FMLStructureSimple>{
          objects: group(simpleObjects, o => o.name),
          rules: fmlGroup.rules,
          connections: fmlGroup.connections
        };
      }),
      maps: fml.maps,
      version: '1'
    };
  }
}
