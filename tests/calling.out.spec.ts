import { test } from '@playwright/test';

import { helpFunctions } from './helpers/helpers';
import dotenv from 'dotenv';

dotenv.config({ path: `.env` });

test.describe('Calling out', () => {
  let helpers: helpFunctions;

  test('calling out & the other party answer & the other party ends the call', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await context.grantPermissions(['microphone']);
    const page1 = await context.newPage();
    helpers = new helpFunctions(page1);

    await page1.goto(process.env.DEMO_URL);

    await helpers.registerUser1(page1, process.env.USER_A, process.env.PASSWORD_A);
  });
});
