import {group} from '@kodality-web/core-util';
import {Bundle, StructureDefinition} from 'fhir/r5';
import {FMLStructure, FMLStructureConnection, FMLStructureObject, FMLStructureRule} from './fml-structure';
import {plainToInstance} from 'class-transformer';

export interface FMLStructureSimple {
  objects: {[name: string]: Omit<FMLStructureObject, 'rawFields'>},
  rules: FMLStructureRule[],
  connections: FMLStructureConnection[]
}

export class FMLStructureSimpleMapper {
  public static toFML(bundle: Bundle<StructureDefinition>, fmls: {[groupName: string]: FMLStructureSimple}): {[groupName: string]: FMLStructure} {
    return group(Object.keys(fmls), k => k, k => {
      const _fml = fmls[k];

      const fml = new FMLStructure();
      fml.bundle = bundle;
      Object.keys(_fml.objects).forEach(k => fml.objects[k] = plainToInstance(FMLStructureObject, {
        ..._fml.objects[k],
        rawFields: _fml.objects[k].fields
      }));
      fml.rules = plainToInstance(FMLStructureRule, _fml.rules);
      fml._connections = plainToInstance(FMLStructureConnection, _fml.connections);
      return fml;
    });
  }

  public static fromFML(fmls: {[groupName: string]: FMLStructure}): {[groupName: string]: FMLStructureSimple} {
    return group(Object.keys(fmls), k => k, k => {
      const fml = fmls[k];
      const simpleObjects = Object.values(fml.objects).map(o => ({
        ...o,
        fields: o.rawFields,
        rawFields: undefined
      }));

      return <FMLStructureSimple>{
        objects: group(simpleObjects, o => o.name),
        rules: fml.rules,
        connections: fml.connections
      };
    });
  }
}
