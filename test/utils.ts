import test from 'ava';
import { fc, testProp } from 'ava-fast-check';

import { eqSet, increaseTimeout, jitter } from '../src/lib/utils';

test('eqSet', t => {
  t.true(eqSet(new Set(), new Set()));
  t.true(eqSet(new Set([]), new Set([])));
  t.true(eqSet(new Set([1, 2, 3, 4]), new Set([4, 3, 2, 1])));
  t.false(eqSet(new Set([1, 2, 3]), new Set([1, 2, 4])));
  t.false(eqSet(new Set([1, 2, 3, 4]), new Set([1, 2])));
  t.false(eqSet(new Set([1, 2]), new Set([1, 2, 3, 4])));
});

test('jitter basics', t => {
  t.is(jitter(2, 0), 2);
  t.is(jitter(100, 0), 100);
  t.true(jitter(100, 100) >= 0);
  t.true(jitter(100, 100) <= 200);
});

testProp('jitter is in range', [fc.nat(), fc.nat(100)], (interval, percentage) => {
  const min = Math.ceil(interval * ((100 - percentage) / 100));
  const max = Math.floor(interval * ((100 + percentage) / 100));
  const sample = jitter(interval, percentage);
  return sample >= 0 && min <= sample && sample <= max;
});

test('increaseTimeout doubles interval', t => {
  const retry = increaseTimeout({ interval: 1, limit: 10 });
  t.is(retry.interval, 2);
  t.true(retry.timeout > 1);
});

test('increaseTimeout honors limit', t => {
  const retry = increaseTimeout({ interval: 8, limit: 10 });
  t.is(retry.interval, 10);
});
