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

    await pageUserA.goto(`${process.env.DEMO_URL}`);
    await helpersA.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpersA.assertAccountStatus('connected');

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertAccountStatus('connected');

    await pageUserC.goto(`${process.env.DEMO_URL}`);
    await helpersC.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    await helpersC.assertAccountStatus('connected');
  });

  test.only('Should not be possible to reach the user, when its DND is on, the call is terminated', async () => {
    await helpersA.checkDndToggle();
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.assertSessionTerminated();
    await helpersB.assertSessionTerminated();

    await helpersA.uncheckDndToggle();
    await helpersB.callNumber(`${process.env.NUMBER_A}`);
    await helpersA.assertSessionExists();
    await helpersB.assertSessionStatus('ringing', 0);
  });

  test('Should not be possible to reach the user after a cold transfer, when its DND is on, the call is terminated', async () => {});

  test('Should not be possible to reach the user after a warm transfer, when its DND is on, the call is terminated', async () => {});
});
