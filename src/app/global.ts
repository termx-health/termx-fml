import {isDevMode} from '@angular/core';

export const isIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};


export const isDev = (): boolean => {
  return isDevMode();
};
