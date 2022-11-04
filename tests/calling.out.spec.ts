import { test } from '@playwright/test';

import { helpFunctions } from './helpers/helpers';

test.describe('Calling out', () => {
  test('calling out & the other party answer & the other party ends the call', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await context.grantPermissions(['microphone']);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const helpers1 = new helpFunctions(page1);
    const helpers2 = new helpFunctions(page2);

    await page1.goto(`${process.env.DEMO_URL}`);
    await helpers1.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    //await helpers1.registerUser(process.env.USER_A as string, process.env.PASSWORD_A as string);

    await page2.goto(`${process.env.DEMO_URL}`);
    await helpers2.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
  });
});
