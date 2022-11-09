import { test } from '@playwright/test';

import { helpFunctions } from './helpers/helpers';

test.describe('Calling out', () => {
  let helpers1: helpFunctions;
  let helpers2: helpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    helpers1 = new helpFunctions(page1);
    helpers2 = new helpFunctions(page2);

    await page1.goto(`${process.env.DEMO_URL}`);
    await helpers1.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    console.log(process.env.USER_A);
    await helpers1.assertClientConnected();

    await page2.goto(`${process.env.DEMO_URL}`);
    await helpers2.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpers2.assertClientConnected();
  });

  test('calling out & the other party answers & the other party ends the call', async () => {
    await helpers2.callNumber(`${process.env.NUMBER_A}`);
    await helpers1.acceptCall();
    await helpers1.assertCallAccepted();
    await helpers1.terminateCall();
    await helpers1.assertCallSessionTerminated();
  });

  test('calling out & the other party answers & calling party ends the call (terminate)', async () => {
    await helpers2.callNumber(`${process.env.NUMBER_A}`);
    await helpers1.acceptCall();
    await helpers1.assertCallAccepted();
    await helpers2.terminateCall();
    await helpers2.assertCallSessionTerminated();
  });
});
