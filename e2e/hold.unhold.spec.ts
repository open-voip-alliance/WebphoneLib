import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Hold/unhold', () => {
  let helpersA: HelpFunctions;
  let helpersB: HelpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const pageUserA = await context.newPage();
    const pageUserB = await context.newPage();
    helpersA = new HelpFunctions(pageUserA);
    helpersB = new HelpFunctions(pageUserB);

    await pageUserA.goto(`${process.env.DEMO_URL}`);
    await helpersA.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpersA.assertAccountStatus('connected');

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertAccountStatus('connected');
  });

  test('calling out & the other party answers & put the call on hold/unhold', async () => {
    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertSessionStatus('ringing');
    await helpersB.assertSessionExists();

    await helpersB.acceptCall();
    await helpersA.assertSessionStatus('active');
    await helpersB.assertSessionStatus('active');

    await helpersB.holdCall();
    await helpersA.assertSessionStatus('active');
    await helpersB.assertSessionStatus('on_hold');

    await helpersB.unholdCall();
    await helpersA.assertSessionStatus('active');
    await helpersB.assertSessionStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });
});
