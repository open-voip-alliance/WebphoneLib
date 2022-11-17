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
  });

  test('User A calls user B, and user B transfers user A to user C via a warm transfer. User C accepts the call', async () => {
    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersB.assertSessionActive();
    await helpersB.acceptCall();
    await helpersB.transferCall(`${process.env.NUMBER_C}`, `${process.env.COLD_TRANSFER}`);
    // Verify the session for User B is terminated after a cold transfer
    await helpersB.assertSessionTerminated();
    // Verify the call for User A is still active
    await helpersA.assertCallActive();
    // Verify the session for User C is created
    await helpersC.assertSessionActive();

    await helpersC.acceptCall();
    // Verify the call for User C is active
    await helpersC.assertCallActive();
    // Figure out if User A need to accept a call (as in the old tests) or not

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
  });
});
