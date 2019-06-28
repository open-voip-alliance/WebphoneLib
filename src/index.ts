import { AudioHelper } from './audio-helper';
import { Client } from './client';
import { checkRequired } from './features';
import { Media } from './media';

if (!checkRequired()) {
  throw new Error('Your browser is not supported by this library');
}

export { Client, Media, AudioHelper };
