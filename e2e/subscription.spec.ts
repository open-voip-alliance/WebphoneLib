import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

test.describe.only('Subscription', () => {
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

  test.afterEach(async () => {
    await helpersA.unsubsribeFromContact();
    await helpersA.assertContactUnsubscribed();
    await helpersB.page.waitForTimeout(5000);
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

  test('After the subscribed contact establish a call its status changes to busy', async () => {
    await helpersA.subsribeToContact(`${process.env.USER_B}`);

    await helpersC.callNumber(`${process.env.NUMBER_B}`);
    await helpersB.acceptCall();
    await helpersA.assertSubscribedContactStatus(`${process.env.USER_B}`, 'busy');
  });

  test('After the subscribed contact calls out its status changes to busy', async () => {
    await helpersA.subsribeToContact(`${process.env.USER_B}`);

    await helpersB.callNumber(`${process.env.NUMBER_C}`);
    await helpersA.assertSubscribedContactStatus(`${process.env.USER_B}`, 'busy');
  });
});
