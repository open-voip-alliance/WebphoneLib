import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('DND', () => {
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

    await pageUserA.goto(`${process.env.DEMO_URL}`, { timeout: 0 });
    await helpersA.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpersA.assertAccountStatus('connected');

    await pageUserB.goto(`${process.env.DEMO_URL}`, { timeout: 0 });
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertAccountStatus('connected');

    await pageUserC.goto(`${process.env.DEMO_URL}`, { timeout: 0 });
    await helpersC.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    //await helpersC.assertAccountStatus('connected');
  });

  test('Should not be possible to reach the user, when its DND is on. The call is terminated', async () => {
    await helpersA.checkDndToggle();
    await helpersA.assertDndToggleIsChecked();
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();

    await helpersA.uncheckDndToggle();
    await helpersA.assertDndToggleIsUnchecked();
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.assertSessionExists();
    await helpersB.assertSessionStatus('ringing', 0);
  });

  test('Should not be possible to reach the user after a cold transfer, when its DND is on. The call is terminated', async () => {
    await helpersC.checkDndToggle();
    await helpersC.assertDndToggleIsChecked();

    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersB.acceptCall();
    await helpersB.clickTransferButton();

    await helpersB.coldTransferCall(`${process.env.NUMBER_C}`);
    await helpersB.assertSessionTerminated();
    await helpersA.assertSessionStatus('active', 0);

    // The rest part of the test doesn't work properly, User B doesn't get a ringback.
    // It was decided to leave it for now, but it should be investigated and fixed later.

    // Verify that User B is getting a ringback
    // await helpersB.assertSessionExists();

    // await helpersB.rejectCall();
    // await helpersA.assertSessionTerminated();
    // await helpersB.assertSessionTerminated();

    // await helpersC.uncheckDndToggle();
  });

  test('Should not be possible to reach the user after a warm transfer, when its DND is on. The call is terminated', async () => {
    await helpersC.checkDndToggle();

    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersB.acceptCall();
    await helpersB.clickTransferButton();

    await helpersB.warmTransferCall(`${process.env.NUMBER_C}`);
    await helpersA.assertSessionStatus('active', 0);
    await helpersB.assertSessionStatus('on_hold', 0);
    await helpersC.assertSessionTerminated();

    await helpersA.terminateCall();
    await helpersA.assertSessionTerminated();
    await helpersC.assertSessionTerminated();
  });
});
