import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Warm transfer', () => {
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

    await helpersB.clickTransferButton();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('on_hold');
  });

  test('User A calls user B, and user B transfers user A to user C via a warm transfer. User C accepts the call', async () => {
    await helpersB.warmTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertCallStatus('active');
    await helpersB.assertTwoActiveSessions();
    await helpersB.assertFirstSessionStatus('on_hold');
    await helpersB.assertSecondSessionStatus('ringing');
    // Verify the session for User C is created
    await helpersC.assertSessionActive();

    await helpersC.acceptCall();
    await helpersA.assertCallStatus('active');
    // Verify both sessions for User B end 3 seconds after User C accept a call
    // This is done in the demo app to simulate a 3 second conversation between users B and C
    await helpersB.assertSessionTerminated();
    // Verify the call for User C is active
    await helpersC.assertCallStatus('active');

    await helpersC.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });

  test('User A calls user B, and user B transfers user A to user C via a warm transfer. User C rejects a call and have user B activate a call to A again', async () => {
    await helpersB.warmTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertCallStatus('active');
    await helpersB.assertTwoActiveSessions();
    await helpersB.assertFirstSessionStatus('on_hold');
    await helpersB.assertSecondSessionStatus('ringing');
    // Verify the session for User C is created
    await helpersC.assertSessionActive();

    await helpersC.rejectCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertSessionActive();
    await helpersB.assertCallStatus('on_hold');
    await helpersC.assertSessionTerminated();

    await helpersB.unholdCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });

  test('User A calls user B, and user B transfers user A to a non-existing number via a warm transfer', async () => {
    await helpersB.warmTransferCall(`${process.env.NON_EXISTING_NUMBER}`);

    // Wait several seconds while User B tries to establish a call
    await helpersB.page.waitForTimeout(5000);

    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('on_hold');
    await helpersC.assertSessionTerminated();

    await helpersB.unholdCall();
    await helpersA.assertCallStatus('active');
    await helpersB.assertCallStatus('active');

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });
});
