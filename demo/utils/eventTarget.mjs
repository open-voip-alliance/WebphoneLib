/*
 This module is to be able to create a cross browser way to use custom events
 For Chrom(ium) and Firefox executing `new EventTarget();` does not throw.
 In Safari it does so we create an (arbitrarily chosen type of) element to use as an eventTarget
*/
export default function eventTarget() {
  try {
    return new EventTarget();
  } catch (err) {
    return document.createElement('i');
  }
}
