import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Internet issues', () => {
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

  test('The account connection is restored after the Internet connection was turned off/on', async ({
    context,
  }) => {
    await context.setOffline(true);
    await helpersA.assertAccountStatus('dying');

    await context.setOffline(false);
    await helpersA.assertAccountStatus('recovering');
    await helpersA.assertAccountStatus('connected');

    // Verify that it's possible to establish a call after the internet turned off/on
    await helpersA.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertSessionStatus('ringing');
  });
});
