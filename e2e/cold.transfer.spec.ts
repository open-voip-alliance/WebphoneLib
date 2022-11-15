import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe.only('Calling out', () => {
  let helpers1: HelpFunctions;
  let helpers2: HelpFunctions;
  let helpers3: HelpFunctions;

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['microphone']);
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const page3 = await context.newPage();
    helpers1 = new HelpFunctions(page1);
    helpers2 = new HelpFunctions(page2);
    helpers3 = new HelpFunctions(page3);

    await page1.goto(`${process.env.DEMO_URL}`);
    await helpers1.registerUser(`${process.env.USER_A}`, `${process.env.PASSWORD_A}`);
    await helpers1.assertClientConnected();

    await page2.goto(`${process.env.DEMO_URL}`);
    await helpers2.registerUser(`${process.env.USER_B}`, `${process.env.PASSWORD_B}`);
    await helpers2.assertClientConnected();

    await page3.goto(`${process.env.DEMO_URL}`);
    await helpers3.registerUser(`${process.env.USER_C}`, `${process.env.PASSWORD_C}`);
    await helpers3.assertClientConnected();
  });

  test('User A calls user B and user B transfers user A to user C via a cold transfer', async () => {
    await helpers1.callNumber(`${process.env.NUMBER_B}`);
    await helpers2.acceptCall();
  });
});
