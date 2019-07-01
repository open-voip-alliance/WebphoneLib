import { Autoplay } from './autoplay';
import { Client } from './client';
import * as Features from './features';
import { log } from './logger';
import { Media } from './media';
import { Sound } from './sound';

if (!Features.checkRequired()) {
  throw new Error('Your browser is not supported by this library');
}

export { Autoplay, Client, Features, log, Media, Sound };
