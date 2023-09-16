import {dynamicEnv} from './dynamic-env';

export const environment = {
  production: true,
  baseHref: dynamicEnv.baseHref,
  buildTime: dynamicEnv.buildTime,
};
