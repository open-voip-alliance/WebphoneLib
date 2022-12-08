import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Calling out', () => {
  let helpersA: HelpFunctions;
  let helpersB: HelpFunctions;
  let helpersC: HelpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const pageUserA = await context.newPage();
    const pageUserB = await context.newPage();
    const pageUserC = await context.newPage();
    helpersA = new HelpFunctions(pageUserA);
    helpersB = new HelpFunctions(pageUserB);
    helpersC = new HelpFunctions(pageUserC);

    await pageUserA.goto(`${process.env.DEMO_URL}`);
    await helpersA.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpersA.assertAccountStatus('connected');

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertAccountStatus('connected');

    await pageUserC.goto(`${process.env.DEMO_URL}`);
    await helpersC.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    await helpersC.assertAccountStatus('connected');

    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertSessionStatus('ringing', 0);
    await helpersB.assertSessionExists();

    await helpersB.acceptCall();
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('active', 0);

    //In a normal situation people would speak to each other as well, so a timeout to really establish the call.
    await helpersB.page.waitForTimeout(4000);

    await helpersB.clickTransferButton();
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('on_hold', 0);
  });

  test('User A calls user B and user B transfers user A to user C via a cold transfer', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    // Verify the call for User A is still active
    await helpersA.assertSessionStatus('active', 0);
    // Verify the session for User B is terminated after a cold transfer
    await helpersB.assertSessionTerminated();
    // Verify the session for User C is created
    await helpersC.assertSessionExists();

    await helpersC.acceptCall();
    await helpersA.assertSessionStatus('active', 0);
    // Verify the call for User C is active
    await helpersC.assertSessionStatus('active', 0);

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });

  test('User A calls user B, user B transfers user A to user C, and user C rejects a call (it means that user B will get a ringback). User B accepts the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionTerminated();
    // Verify that User C is getting a call
    await helpersC.assertSessionExists();

    await helpersC.rejectCall();
    await helpersA.assertSessionStatus('active', 0);
    // Verify that User B is getting a ringback
    await helpersB.assertSessionExists();
    await helpersC.assertSessionTerminated();

    await helpersB.acceptCall();
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('active', 0);

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('User A calls user B, user B transfers user A to user C, and user C rejects a call (it means that user B will get a ringback). User B declines the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionTerminated();
    // Verify that User C is getting a call
    await helpersC.assertSessionExists();

    await helpersC.rejectCall();
    await helpersA.assertSessionStatus('active', 0);
    // Verify that User B is getting a ringback
    await helpersB.assertSessionExists();
    await helpersC.assertSessionTerminated();

    await helpersB.rejectCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('User A calls user B and user B transfers user A to non-existing number (it means that user B will get a ringback). User B accepts the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NON_EXISTING_NUMBER}`);
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionTerminated();

    // Verify that User B is getting a ringback
    await helpersB.assertSessionExists();

    await helpersB.acceptCall();
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('active', 0);

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });
});
