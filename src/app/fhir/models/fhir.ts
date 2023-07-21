export type base64Binary = any;
// export type boolean = string;
export type canonical = string;
export type code = string;
export type date = string | Date;
export type dateTime = string | Date;
export type decimal = number;
export type id = string;
export type instant = string | Date;
export type integer = number;
export type integer64 = number;
export type markdown = string;
export type oid = string;
// export type string = string;
export type positiveInt = string;
export type time = string | DataTransfer;
export type unsignedInt = number;
export type uri = string;
export type url = string;
export type uuid = string;


export class FHIRCoding {
  id?: string;
  resourceType?: string;
  system?: uri;
  version?: string;
  code?: code;
  display?: string;
  userSelected?: boolean;
}

export class FHIRCodeableConcept {
  id?: string;
  resourceType?: string;
  coding?: FHIRCoding[];
  text?: string;
}

export class FHIRPeriod {
  id?: string;
  resourceType?: string;
  start?: dateTime;
  end?: dateTime;
}

export class FHIRReference {
  id?: string;
  resourceType?: string;
  reference?: string;
  type?: uri;
  identifier?: FHIRIdentifier;
  display?: string;
}

export class FHIRIdentifier {
  id?: string;
  resourceType?: string;
  use?: code;
  type?: FHIRCodeableConcept;
  system?: uri;
  value?: string;
  period?: FHIRPeriod;
  assigner?: FHIRReference;
}

export class FHIRContactPoint {
  id?: string;
  resourceType?: string;
  system?: code;
  value?: string;
  use?: code;
  rank?: positiveInt;
  period?: FHIRPeriod;
}

export class FHIRContactDetail {
  id?: string;
  resourceType?: string;
  name?: string;
  telecom?: FHIRContactPoint[];
}

export class FHIRQuantity {
  id?: string;
  resourceType?: string;
  value?: decimal;
  comparator?: code;
  unit?: string;
  system?: uri;
  code?: code;
}

export class FHIRRange {
  id?: string;
  resourceType?: string;
  low?: FHIRQuantity;
  high?: FHIRQuantity;
}

export class FHIRUsageContext {
  id?: string;
  resourceType?: string;
  code: FHIRCoding;
  valueCodeableConcept: FHIRCodeableConcept;
  valueQuantity: FHIRQuantity;
  valueRange: FHIRRange;
  valueReference: FHIRReference;
}

export class FHIRStructureMap {
  id?: string;
  resourceType?: string;
  url: uri;
  identifier?: FHIRIdentifier[];
  version?: string;
  versionAlgorithmString?: string;
  versionAlgorithmCoding?: FHIRCoding;
  name: string;
  title?: string;
  status: code;
  experimental?: boolean;
  date?: dateTime;
  publisher?: string;
  contact?: FHIRContactDetail[];
  description?: markdown;
  useContext?: FHIRUsageContext[];
  jurisdiction?: FHIRCodeableConcept[];
  purpose?: markdown;
  copyright?: markdown;
  copyrightLabel?: string;
  structure?: {
    url: canonical;
    mode: code;
    alias?: string;
    documentation?: string;
  }[];
  import?: canonical[];
  const?: {
    name?: id;
    value?: string;
  }[];
  group: {
    name: id;
    extends?: id;
    typeMode?: code;
    documentation?: string;
    input: {
      name: id;
      type?: string;
      mode: code;
      documentation?: string;
    }[];
    rule?: {
      name?: id;
      source: {
        context: id;
        min?: integer;
        max?: string;
        type?: string;
        defaultValue?: string;
        element?: string;
        listMode?: code;
        variable?: id;
        condition?: string;
        check?: string;
        logMessage?: string;
      }[];
      target?: {
        context?: string;
        element?: string;
        variable?: id;
        listMode?: code[];
        listRuleId?: id;
        transform?: code;
        parameter?: {
          valueId: id;
          valueString: string;
          valueBoolean: boolean;
          valueInteger: integer;
          valueDecimal: decimal;
          valueDate: date;
          valueTime: time;
          valueDateTime: dateTime;
        }[];
      }[];
      rule?: any[];
      dependent?: {
        name: id;
        parameter: any[];
      }[];
      documentation?: string;
    }[];
  }[];
}

export class FHIRAddress {
  id?: string;
  resourceType?: string;
  use?: code;
  type?: code;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FHIRPeriod;
}

export class FHIRAge {
  id?: string;
  resourceType?: string;
}

export class FHIRAnnotation {
  id?: string;
  resourceType?: string;
  authorReference?: FHIRReference;
  authorString?: string;
  time?: dateTime;
  text: markdown;
}

export class FHIRAttachment {
  id?: string;
  resourceType?: string;
  contentType?: code;
  language?: code;
  data?: base64Binary;
  url?: url;
  size?: integer64;
  hash?: base64Binary;
  title?: string;
  creation?: dateTime;
  height?: positiveInt;
  width?: positiveInt;
  frames?: positiveInt;
  duration?: decimal;
  pages?: positiveInt;
}

export class FHIRCodeableReference {
  id?: string;
  resourceType?: string;
  concept?: FHIRCodeableConcept;
  reference?: FHIRReference;
}

export class FHIRCount {
  id?: string;
  resourceType?: string;
}

export class FHIRDistance {
  id?: string;
  resourceType?: string;
}

export class FHIRDuration {
  id?: string;
  resourceType?: string;
}

export class FHIRHumanName {
  id?: string;
  resourceType?: string;
  use?: code;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FHIRPeriod;
}

export class FHIRMoney {
  id?: string;
  resourceType?: string;
  value?: decimal;
  currency?: code;
}

export class FHIRRatio {
  id?: string;
  resourceType?: string;
  numerator?: FHIRQuantity;
  denominator?: FHIRQuantity;
}

export class FHIRRatioRange {
  id?: string;
  resourceType?: string;
  lowNumerator?: FHIRQuantity;
  highNumerator?: FHIRQuantity;
  denominator?: FHIRQuantity;
}

export class FHIRSampledData {
  id?: string;
  resourceType?: string;
  origin: FHIRQuantity;
  interval?: decimal;
  intervalUnit: code;
  factor?: decimal;
  lowerLimit?: decimal;
  upperLimit?: decimal;
  dimensions: positiveInt;
  codeMap?: canonical;
  offsets?: string;
  data?: string;
}

export class FHIRSignature {
  id?: string;
  resourceType?: string;
  type?: FHIRCoding[];
  when?: instant;
  who?: FHIRReference;
  onBehalfOf?: FHIRReference;
  targetFormat?: code;
  sigFormat?: code;
  data?: base64Binary;
}

export class FHIRTiming {
  id?: string;
  resourceType?: string;
  event?: dateTime[];
  repeat?: {
    boundsDuration?: FHIRDuration;
    boundsRange?: FHIRRange;
    boundsPeriod?: FHIRPeriod;
    count?: positiveInt;
    countMax?: positiveInt;
    duration?: decimal;
    durationMax?: decimal;
    durationUnit?: code;
    frequency?: positiveInt;
    frequencyMax?: positiveInt;
    period?: decimal;
    periodMax?: decimal;
    periodUnit?: code;
    dayOfWeek?: code[];
    timeOfDay?: time[];
    when?: code[];
    offset?: unsignedInt;
  };
  code?: FHIRCodeableConcept;
}

export class FHIRDataRequirement {
  id?: string;
  resourceType?: string;
  type: code;
  profile?: canonical[];
  subjectCodeableConcept?: FHIRCodeableConcept;
  subjectReference?: FHIRReference;
  mustSupport?: string[];
  codeFilter?: {
    path?: string;
    searchParam?: string;
    valueSet?: canonical;
    code?: FHIRCoding[];
  }[];
  dateFilter?: {
    path?: string;
    searchParam?: string;
    valueDateTime?: dateTime;
    valuePeriod?: FHIRPeriod;
    valueDuration?: FHIRDuration;
  }[];
  valueFilter?: {
    path?: string;
    searchParam?: string;
    comparator?: code;
    valueDateTime?: dateTime;
    valuePeriod?: FHIRPeriod;
    valueDuration?: FHIRDuration;
  }[];
  limit?: positiveInt;
  sort?: {
    path: string;
    direction: code;
  }[];
}

export class FHIRExpression {
  id?: string;
  resourceType?: string;
  description?: string;
  name?: code;
  language?: code;
  expression?: string;
  reference?: uri;
}

export class FHIRParameterDefinition {
  id?: string;
  resourceType?: string;
  name?: code;
  use: code;
  min?: integer;
  max?: string;
  documentation?: string;
  type: code;
  profile?: canonical;
}

export class FHIRRelatedArtifact {
  id?: string;
  resourceType?: string;
  type: code;
  classifier?: FHIRCodeableConcept[];
  label?: string;
  display?: string;
  citation?: markdown;
  document?: FHIRAttachment;
  resource?: canonical;
  resourceReference?: FHIRReference;
  publicationStatus?: code;
  publicationDate?: date;
}

export class FHIRTriggerDefinition {
  id?: string;
  resourceType?: string;
  type: code;
  name?: string;
  code?: FHIRCodeableConcept;
  subscriptionTopic?: canonical;
  timingTiming?: FHIRTiming;
  timingReference?: FHIRReference;
  timingDate?: date;
  timingDateTime?: dateTime;
  data?: FHIRDataRequirement[];
  condition?: FHIRExpression;
}

export class FHIRAvailability {
  id?: string;
  resourceType?: string;
  availableTime?: {
    daysOfWeek?: code[];
    allDay?: boolean;
    availableStartTime?: time;
    availableEndTime?: time;
  }[];
  notAvailableTime?: {
    description?: string;
    during?: FHIRPeriod;
  }[];
}

export class FHIRExtendedContactDetail {
  id?: string;
  resourceType?: string;
  purpose?: FHIRCodeableConcept;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  organization?: FHIRReference;
  period?: FHIRPeriod;
}

export class FHIRDosage {
  id?: string;
  resourceType?: string;
  sequence?: integer;
  text?: string;
  additionalInstruction?: FHIRCodeableConcept[];
  patientInstruction?: string;
  timing?: FHIRTiming;
  asNeeded?: boolean;
  asNeededFor?: FHIRCodeableConcept[];
  site?: FHIRCodeableConcept;
  route?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  doseAndRate?: {
    type?: FHIRCodeableConcept;
    doseRange?: FHIRRange;
    doseQuantity?: FHIRQuantity;
    rateRatio?: FHIRRatio;
    rateRange?: FHIRRange;
    rateQuantity?: FHIRQuantity;
  }[];
  maxDosePerPeriod?: FHIRRatio[];
  maxDosePerAdministration?: FHIRQuantity;
  maxDosePerLifetime?: FHIRQuantity;
}

export class FHIRMeta {
  id?: string;
  resourceType?: string;
  versionId?: id;
  lastUpdated?: instant;
  source?: uri;
  profile?: canonical[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

export class FHIRElementDefinition {
  id?: string;
  resourceType?: string;
  path: string;
  representation?: code[];
  sliceName?: string;
  sliceIsConstraining?: boolean;
  label?: string;
  code?: FHIRCoding[];
  slicing?: {
    discriminator?: {
      type: code;
      path: string;
    }[];
    description?: string;
    ordered?: boolean;
    rules: code;
  };
  short?: string;
  definition?: markdown;
  comment?: markdown;
  requirements?: markdown;
  alias?: string[];
  min?: unsignedInt;
  max?: string;
  base?: {
    path: string;
    min: unsignedInt;
    max: string;
  };
  contentReference?: uri;
  type?: {
    code: uri;
    profile?: canonical[];
    targetProfile?: canonical[];
    aggregation?: code[];
    versioning?: code;
  }[];
  defaultValueBase64Binary?: base64Binary;
  defaultValueBoolean?: boolean;
  defaultValueCanonical?: canonical;
  defaultValueCode?: code;
  defaultValueDate?: date;
  defaultValueDateTime?: dateTime;
  defaultValueDecimal?: decimal;
  defaultValueId?: id;
  defaultValueInstant?: instant;
  defaultValueInteger?: integer;
  defaultValueInteger64?: integer64;
  defaultValueMarkdown?: markdown;
  defaultValueOid?: oid;
  defaultValuePositiveInt?: positiveInt;
  defaultValueString?: string;
  defaultValueTime?: time;
  defaultValueUnsignedInt?: unsignedInt;
  defaultValueUri?: uri;
  defaultValueUrl?: url;
  defaultValueUuid?: uuid;
  defaultValueAddress?: FHIRAddress;
  defaultValueAge?: FHIRAge;
  defaultValueAnnotation?: FHIRAnnotation;
  defaultValueAttachment?: FHIRAttachment;
  defaultValueCodeableConcept?: FHIRCodeableConcept;
  defaultValueCodeableReference?: FHIRCodeableReference;
  defaultValueCoding?: FHIRCoding;
  defaultValueContactPoint?: FHIRContactPoint;
  defaultValueCount?: FHIRCount;
  defaultValueDistance?: FHIRDistance;
  defaultValueDuration?: FHIRDuration;
  defaultValueHumanName?: FHIRHumanName;
  defaultValueIdentifier?: FHIRIdentifier;
  defaultValueMoney?: FHIRMoney;
  defaultValuePeriod?: FHIRPeriod;
  defaultValueQuantity?: FHIRQuantity;
  defaultValueRange?: FHIRRange;
  defaultValueRatio?: FHIRRatio;
  defaultValueRatioRange?: FHIRRatioRange;
  defaultValueReference?: FHIRReference;
  defaultValueSampledData?: FHIRSampledData;
  defaultValueSignature?: FHIRSignature;
  defaultValueTiming?: FHIRTiming;
  defaultValueContactDetail?: FHIRContactDetail;
  defaultValueDataRequirement?: FHIRDataRequirement;
  defaultValueExpression?: FHIRExpression;
  defaultValueParameterDefinition?: FHIRParameterDefinition;
  defaultValueRelatedArtifact?: FHIRRelatedArtifact;
  defaultValueTriggerDefinition?: FHIRTriggerDefinition;
  defaultValueUsageContext?: FHIRUsageContext;
  defaultValueAvailability?: FHIRAvailability;
  defaultValueExtendedContactDetail?: FHIRExtendedContactDetail;
  defaultValueDosage?: FHIRDosage;
  defaultValueMeta?: FHIRMeta;
  meaningWhenMissing?: markdown;
  orderMeaning?: string;
  fixedBase64Binary?: base64Binary;
  fixedBoolean?: boolean;
  fixedCanonical?: canonical;
  fixedCode?: code;
  fixedDate?: date;
  fixedDateTime?: dateTime;
  fixedDecimal?: decimal;
  fixedId?: id;
  fixedInstant?: instant;
  fixedInteger?: integer;
  fixedInteger64?: integer64;
  fixedMarkdown?: markdown;
  fixedOid?: oid;
  fixedPositiveInt?: positiveInt;
  fixedString?: string;
  fixedTime?: time;
  fixedUnsignedInt?: unsignedInt;
  fixedUri?: uri;
  fixedUrl?: url;
  fixedUuid?: uuid;
  fixedAddress?: FHIRAddress;
  fixedAge?: FHIRAge;
  fixedAnnotation?: FHIRAnnotation;
  fixedAttachment?: FHIRAttachment;
  fixedCodeableConcept?: FHIRCodeableConcept;
  fixedCodeableReference?: FHIRCodeableReference;
  fixedCoding?: FHIRCoding;
  fixedContactPoint?: FHIRContactPoint;
  fixedCount?: FHIRCount;
  fixedDistance?: FHIRDistance;
  fixedDuration?: FHIRDuration;
  fixedHumanName?: FHIRHumanName;
  fixedIdentifier?: FHIRIdentifier;
  fixedMoney?: FHIRMoney;
  fixedPeriod?: FHIRPeriod;
  fixedQuantity?: FHIRQuantity;
  fixedRange?: FHIRRange;
  fixedRatio?: FHIRRatio;
  fixedRatioRange?: FHIRRatioRange;
  fixedReference?: FHIRReference;
  fixedSampledData?: FHIRSampledData;
  fixedSignature?: FHIRSignature;
  fixedTiming?: FHIRTiming;
  fixedContactDetail?: FHIRContactDetail;
  fixedDataRequirement?: FHIRDataRequirement;
  fixedExpression?: FHIRExpression;
  fixedParameterDefinition?: FHIRParameterDefinition;
  fixedRelatedArtifact?: FHIRRelatedArtifact;
  fixedTriggerDefinition?: FHIRTriggerDefinition;
  fixedUsageContext?: FHIRUsageContext;
  fixedAvailability?: FHIRAvailability;
  fixedExtendedContactDetail?: FHIRExtendedContactDetail;
  fixedDosage?: FHIRDosage;
  fixedMeta?: FHIRMeta;
  patternBase64Binary?: base64Binary;
  patternBoolean?: boolean;
  patternCanonical?: canonical;
  patternCode?: code;
  patternDate?: date;
  patternDateTime?: dateTime;
  patternDecimal?: decimal;
  patternId?: id;
  patternInstant?: instant;
  patternInteger?: integer;
  patternInteger64?: integer64;
  patternMarkdown?: markdown;
  patternOid?: oid;
  patternPositiveInt?: positiveInt;
  patternString?: string;
  patternTime?: time;
  patternUnsignedInt?: unsignedInt;
  patternUri?: uri;
  patternUrl?: url;
  patternUuid?: uuid;
  patternAddress?: FHIRAddress;
  patternAge?: FHIRAge;
  patternAnnotation?: FHIRAnnotation;
  patternAttachment?: FHIRAttachment;
  patternCodeableConcept?: FHIRCodeableConcept;
  patternCodeableReference?: FHIRCodeableReference;
  patternCoding?: FHIRCoding;
  patternContactPoint?: FHIRContactPoint;
  patternCount?: FHIRCount;
  patternDistance?: FHIRDistance;
  patternDuration?: FHIRDuration;
  patternHumanName?: FHIRHumanName;
  patternIdentifier?: FHIRIdentifier;
  patternMoney?: FHIRMoney;
  patternPeriod?: FHIRPeriod;
  patternQuantity?: FHIRQuantity;
  patternRange?: FHIRRange;
  patternRatio?: FHIRRatio;
  patternRatioRange?: FHIRRatioRange;
  patternReference?: FHIRReference;
  patternSampledData?: FHIRSampledData;
  patternSignature?: FHIRSignature;
  patternTiming?: FHIRTiming;
  patternContactDetail?: FHIRContactDetail;
  patternDataRequirement?: FHIRDataRequirement;
  patternExpression?: FHIRExpression;
  patternParameterDefinition?: FHIRParameterDefinition;
  patternRelatedArtifact?: FHIRRelatedArtifact;
  patternTriggerDefinition?: FHIRTriggerDefinition;
  patternUsageContext?: FHIRUsageContext;
  patternAvailability?: FHIRAvailability;
  patternExtendedContactDetail?: FHIRExtendedContactDetail;
  patternDosage?: FHIRDosage;
  patternMeta?: FHIRMeta;
  example?: {
    label: string;
    valueBase64Binary: base64Binary;
    valueBoolean: boolean;
    valueCanonical: canonical;
    valueCode: code;
    valueDate: date;
    valueDateTime: dateTime;
    valueDecimal: decimal;
    valueId: id;
    valueInstant: instant;
    valueInteger: integer;
    valueInteger64: integer64;
    valueMarkdown: markdown;
    valueOid: oid;
    valuePositiveInt: positiveInt;
    valueString: string;
    valueTime: time;
    valueUnsignedInt: unsignedInt;
    valueUri: uri;
    valueUrl: url;
    valueUuid: uuid;
    valueAddress: FHIRAddress;
    valueAge: FHIRAge;
    valueAnnotation: FHIRAnnotation;
    valueAttachment: FHIRAttachment;
    valueCodeableConcept: FHIRCodeableConcept;
    valueCodeableReference: FHIRCodeableReference;
    valueCoding: FHIRCoding;
    valueContactPoint: FHIRContactPoint;
    valueCount: FHIRCount;
    valueDistance: FHIRDistance;
    valueDuration: FHIRDuration;
    valueHumanName: FHIRHumanName;
    valueIdentifier: FHIRIdentifier;
    valueMoney: FHIRMoney;
    valuePeriod: FHIRPeriod;
    valueQuantity: FHIRQuantity;
    valueRange: FHIRRange;
    valueRatio: FHIRRatio;
    valueRatioRange: FHIRRatioRange;
    valueReference: FHIRReference;
    valueSampledData: FHIRSampledData;
    valueSignature: FHIRSignature;
    valueTiming: FHIRTiming;
    valueContactDetail: FHIRContactDetail;
    valueDataRequirement: FHIRDataRequirement;
    valueExpression: FHIRExpression;
    valueParameterDefinition: FHIRParameterDefinition;
    valueRelatedArtifact: FHIRRelatedArtifact;
    valueTriggerDefinition: FHIRTriggerDefinition;
    valueUsageContext: FHIRUsageContext;
    valueAvailability: FHIRAvailability;
    valueExtendedContactDetail: FHIRExtendedContactDetail;
    valueDosage: FHIRDosage;
    valueMeta: FHIRMeta;
  }[];
  minValueDate?: date;
  minValueDateTime?: dateTime;
  minValueInstant?: instant;
  minValueTime?: time;
  minValueDecimal?: decimal;
  minValueInteger?: integer;
  minValueInteger64?: integer64;
  minValuePositiveInt?: positiveInt;
  minValueUnsignedInt?: unsignedInt;
  minValueQuantity?: FHIRQuantity;
  maxValueDate?: date;
  maxValueDateTime?: dateTime;
  maxValueInstant?: instant;
  maxValueTime?: time;
  maxValueDecimal?: decimal;
  maxValueInteger?: integer;
  maxValueInteger64?: integer64;
  maxValuePositiveInt?: positiveInt;
  maxValueUnsignedInt?: unsignedInt;
  maxValueQuantity?: FHIRQuantity;
  maxLength?: integer;
  condition?: id[];
  constraint?: {
    key: id;
    requirements?: markdown;
    severity: code;
    suppress?: boolean;
    human: string;
    expression?: string;
    source?: canonical;
  }[];
  mustHaveValue?: boolean;
  valueAlternatives?: canonical[];
  mustSupport?: boolean;
  isModifier?: boolean;
  isModifierReason?: string;
  isSummary?: boolean;
  binding?: {
    strength: code;
    description?: markdown;
    valueSet?: canonical;
    additional?: {
      purpose: code;
      valueSet: canonical;
      documentation?: markdown;
      shortDoco?: string;
      usage?: FHIRUsageContext[];
      any?: boolean;
    }[];
  };
  mapping?: {
    identity: id;
    language?: code;
    map: string;
    comment?: markdown;
  }[];
}

export class FHIRStructureDefinition {
  id?: string;
  resourceType?: string;
  url: uri;
  identifier?: FHIRIdentifier[];
  version?: string;
  versionAlgorithmString?: string;
  versionAlgorithmCoding?: FHIRCoding;
  name: string;
  title?: string;
  status: code;
  experimental?: boolean;
  date?: dateTime;
  publisher?: string;
  contact?: FHIRContactDetail[];
  description?: markdown;
  useContext?: FHIRUsageContext[];
  jurisdiction?: FHIRCodeableConcept[];
  purpose?: markdown;
  copyright?: markdown;
  copyrightLabel?: string;
  keyword?: FHIRCoding[];
  fhirVersion?: code;
  mapping?: {
    identity: id;
    uri?: uri;
    name?: string;
    comment?: string;
  }[];
  kind: code;
  abstract: boolean;
  context?: {
    type: code;
    expression: string;
  }[];
  contextInvariant?: string[];
  type: uri;
  baseDefinition?: canonical;
  derivation?: code;
  snapshot?: {
    element: FHIRElementDefinition[];
  };
  differential?: {
    element: FHIRElementDefinition[];
  };
}
