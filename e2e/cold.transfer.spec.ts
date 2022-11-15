import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Calling out', () => {
  let helpers1: HelpFunctions;
  let helpers2: HelpFunctions;
  let helpers3: HelpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();
    helpers1 = new HelpFunctions(page1);
    helpers2 = new HelpFunctions(page2);
    helpers3 = new HelpFunctions(page3);

    await page1.goto(`${process.env.DEMO_URL}`);
    await helpers1.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpers1.assertClientConnected();

    await page2.goto(`${process.env.DEMO_URL}`);
    await helpers2.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpers2.assertClientConnected();

    await page3.goto(`${process.env.DEMO_URL}`);
    await helpers3.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    await helpers3.assertClientConnected();

    await helpers1.callNumber(`${process.env.NUMBER_B}`);
    await helpers2.assertSessionActive();
    await helpers2.acceptCall();
  });

  test('User A calls user B and user B transfers user A to user C via a cold transfer', async () => {
    await helpers2.coldTransferCall(`${process.env.NUMBER_C}`);
    // Verify the session for User B is terminated after a cold transfer
    await helpers2.assertSessionTerminated();
    // Verify the call for User A is still active
    await helpers1.assertCallActive();
    // Verify the session for User C is created
    await helpers3.assertSessionActive();
    await helpers3.acceptCall();
    // Verify the call for User C is active
    await helpers3.assertCallActive();
    // Figure out if User A need to accept a call (as in the old tests) or not
  });

  test.only('User A calls user B, user B transfers user A to user C, and user C reject a call (it means that user A will get a ringback). User A accepts the ringback', async () => {
    await helpers2.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpers3.rejectCall();
    // Verify the session for User C is terminated
    await helpers3.assertSessionTerminated();
    // Verify the call for User A is still active
    await helpers1.assertCallActive();
    // Verify that User B is getting a ringback
    await helpers2.assertSessionActive();
    await helpers2.acceptCall();
    // Verify the call for User B is active
    await helpers2.assertCallActive();
  });
});
