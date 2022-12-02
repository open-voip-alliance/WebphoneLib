import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Hold/unhold', () => {
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
    await helpersA.assertAccountStatus('connected');

    await pageUserB.goto(`${process.env.DEMO_URL}`);
    await helpersB.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpersB.assertAccountStatus('connected');
  });

  test.only('User sees the status of the contact he subscribed to', async () => {
    await helpersA.subsribeToContact(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus(`${process.env.USER_B}`, 'available');
  });
});
