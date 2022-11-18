import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Calling out', () => {
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
    await helpersA.assertClientConnected();

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertClientConnected();
  });

  test('calling out & the other party answers & the other party ends the call', async () => {
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.assertSessionActive();
    await helpersA.acceptCall();
    await helpersA.assertCallActive();
    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('calling out & the other party answers & calling party ends the call (terminate)', async () => {
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.acceptCall();
    await helpersA.assertCallActive();
    await helpersB.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('calling out & calling party ends the call before it is answered (cancel)', async () => {
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersB.cancelCall();
    await helpersB.assertSessionTerminated();
    await helpersA.assertSessionTerminated();
  });

  test('calling out & the other party rejects the call', async () => {
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.rejectCall();
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();
  });

  test('calling out while other party is not available', async () => {
    await helpersA.unregisterUser();
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersB.assertSessionTerminated();
  });

  test('calling out while other party does not exist', async () => {
    await helpersB.callNumber(`${process.env.NON_EXISTING_NUMBER}`);
    await helpersB.assertSessionTerminated();
  });
});
