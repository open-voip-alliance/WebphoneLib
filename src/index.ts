import { Autoplay } from './autoplay';
import { Client } from './client';
import { Media } from './media';
import { Sound } from './sound';

import { checkRequired } from './features';

if (!checkRequired()) {
  throw new Error('Your browser is not supported by this library');
}

export { Autoplay, Client, Media, Sound };
