import {Bundle, StructureDefinition} from 'fhir/r5';
import {group} from '@kodality-web/core-util';
import {FMLStructure, FMLStructureGroup, FMLStructureRule} from '../fml-structure';
import {FmlStructureComposer} from '../fml-structure-composer';
import {asStructureDefinition} from './test.util';


describe('basic', () => {
  const bundle: Bundle<StructureDefinition> = {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: asStructureDefinition('model_a', {
          a: 'String',
          b: 'String',
        })
      }]
  };


  const conf = {
    models: {
      src: [['model_a', 'model_a1']],
      tgt: [['model_a', 'model_a2']]
    },
    rules: [
      {
        name: 'copy_a',
        src: [['model_a1', 'a']],
        tgt: [['model_a2', 'a']],
        action: 'copy',
        parameters: ['$1']
      }
    ]
  };

  const grup = new FMLStructureGroup('main', () => bundle);
  // group inputs
  conf.models.src.forEach(([resource, name]) => grup.objects[name] = grup.newFMLObject(resource, name, 'source'));
  conf.models.tgt.forEach(([resource, name]) => grup.objects[name] = grup.newFMLObject(resource, name, 'target'));

  // group rules
  conf.rules.forEach(r => {
    const rule = new FMLStructureRule();
    rule.name = r.name;
    rule.action = r.action;

    // rule parameters
    const m = group(r.src.map((el, i) => [`$${i + 1}`, el[0]]), e => e[0], e => e[1]);
    rule.parameters = r.parameters?.map(p => m[p] ? {type: 'var', value: m[p]} : {type: 'const', value: p});

    // rule source connections
    r.src.forEach(((src, idx) => {
      const [name, field] = src;
      const con = grup.newFMLConnection(name, grup.objects[name]?.fieldIndex(field), rule.name, idx);
      grup.putConnection(con);
    }));

    // rule target connections
    r.tgt.forEach(((tgt, idx) => {
      const [name, field] = tgt;
      const con = grup.newFMLConnection(rule.name, idx, name, grup.objects[name]?.fieldIndex(field));
      grup.putConnection(con);
    }));

    grup.putRule(rule);
  });


  // FML structure
  const fml = new FMLStructure();
  fml.bundle = bundle;
  fml.mainGroupName = 'main';
  fml.setGroup(grup);


  // generated StrctureMap
  const gen = FmlStructureComposer.generate(fml);


  it('should have a group', () => {
    expect(gen.group.length).toBe(1);
  });

  it('should have a rule', () => {
    expect(gen.group[0].rule.length).toBe(1);
  });
});
