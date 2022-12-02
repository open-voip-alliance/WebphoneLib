import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Hold/unhold', () => {
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

  test('User sibscribed to another contact and sees their status', async () => {
    await helpersA.subsribeToContact(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus(`${process.env.USER_B}`, 'available');
  });

  test('After the subscribed contact gets an incoming call its status changes to ringing', async () => {
    await helpersA.subsribeToContact(`${process.env.USER_B}`);

    await helpersC.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertSubscribedContactStatus(`${process.env.USER_B}`, 'ringing');
  });
});
