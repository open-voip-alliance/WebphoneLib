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
    await helpersA.assertClientConnected();

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertClientConnected();

    await pageUserC.goto(`${process.env.DEMO_URL}`);
    await helpersC.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    await helpersC.assertClientConnected();

    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertCallStatus('ringing');
    await helpersB.assertSessionActive();

    await helpersB.acceptCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('active');

    //In a normal situation people would speak to each other as well, so a timeout to really establish the call.
    await helpersB.page.waitForTimeout(4000);

    await helpersB.clickTransferButton();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('on_hold');
  });

  test('User A calls user B and user B transfers user A to user C via a cold transfer', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    // Verify the call for User A is still active
    await helpersA.assertCallStatus('active');
    // Verify the session for User B is terminated after a cold transfer
    await helpersB.assertSessionTerminated();
    // Verify the session for User C is created
    await helpersC.assertSessionActive();

    await helpersC.acceptCall();
    await helpersA.assertCallStatus('active');
    // Verify the call for User C is active
    await helpersC.assertCallStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });

  test('User A calls user B, user B transfers user A to user C, and user C rejects a call (it means that user B will get a ringback). User B accepts the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertCallStatus('active');
    await helpersB.assertSessionTerminated();
    // Verify that User C is getting a call
    await helpersC.assertSessionActive();

    await helpersC.rejectCall();
    await helpersA.assertCallStatus('active');
    // Verify that User B is getting a ringback
    await helpersB.assertSessionActive();
    await helpersC.assertSessionTerminated();

    await helpersB.acceptCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('User A calls user B, user B transfers user A to user C, and user C rejects a call (it means that user B will get a ringback). User B declines the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertCallStatus('active');
    await helpersB.assertSessionTerminated();
    // Verify that User C is getting a call
    await helpersC.assertSessionActive();

    await helpersC.rejectCall();
    await helpersA.assertCallStatus('active');
    // Verify that User B is getting a ringback
    await helpersB.assertSessionActive();
    await helpersC.assertSessionTerminated();

    await helpersB.rejectCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('User A calls user B and user B transfers user A to non-existing number (it means that user B will get a ringback). User B accepts the ringback', async () => {
    await helpersB.coldTransferCall(`${process.env.NON_EXISTING_NUMBER}`);
    await helpersA.assertCallStatus('active');
    await helpersB.assertSessionTerminated();

    // Verify that User B is getting a ringback
    await helpersB.assertSessionActive();

    await helpersB.acceptCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });
});
