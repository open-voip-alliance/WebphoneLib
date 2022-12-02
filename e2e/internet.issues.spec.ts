import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe('Internet issues', () => {
  let helpersA: HelpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const pageUserA = await context.newPage();
    helpersA = new HelpFunctions(pageUserA);

    await pageUserA.goto(`${process.env.DEMO_URL}`);
    await helpersA.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpersA.assertAccountStatus('connected');
  });

  test('The account connection is restored after the Internet connection was turned off/on', async ({
    context,
  }) => {
    await context.setOffline(true);
    await helpersA.assertAccountStatus('dying');

    await context.setOffline(false);
    await helpersA.assertAccountStatus('recovering');
    await helpersA.assertAccountStatus('connected');
  });
});
