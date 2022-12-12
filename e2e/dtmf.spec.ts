import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

// !!!
// The test data should be created: Dial plan extension (807 - IVR Menu with the option one (1): call to the User B Webphone account),
// the option two (2) - undefined.
// !!!

test.describe('DTMF', () => {
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

  test('Pressing the predefined number in the IVR menu ends up at the User B webphone account', async () => {
    await helpersA.callNumber(`${process.env.EXTENSION_IVR}`);
    await helpersA.assertSessionStatus('ringing', 0);

    await helpersA.openIVRMenu();
    await helpersA.assertIVRMenuOpened();

    await helpersB.page.waitForTimeout(1000);
    await helpersA.selectIVRMenuOption('1');
    await helpersA.assertSessionStatus('active', 0);
    // Verify that the User B has an incoming call
    await helpersB.assertSessionExists();

    await helpersB.acceptCall();
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('active', 0);

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('Pressing the undefined number in the IVR menu terminates the existing session', async () => {
    await helpersA.callNumber(`${process.env.EXTENSION_IVR}`);
    await helpersA.assertSessionStatus('ringing', 0);

    await helpersA.openIVRMenu();
    await helpersA.assertIVRMenuOpened();

    await helpersB.page.waitForTimeout(1000);
    await helpersA.selectIVRMenuOption('2');
    await helpersA.assertSessionTerminated();
  });
});
