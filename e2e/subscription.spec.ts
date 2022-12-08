import { test } from '@playwright/test';

import { HelpFunctions } from './helpers/helpers';

// !!!
// Run this testsuit no more than once in 1 minute or it will fail (not more than 2 subscriptions is allowed)
// (with error in console: Subscription rate-limited. Retrying after 60)
// !!!

test.describe('Subscription', () => {
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
    await helpersA.unsubscribeFromContact(`${process.env.USER_B}`);
    await helpersA.assertContactUnsubscribed(`${process.env.USER_B}`);
    await helpersA.unsubscribeFromContact(`${process.env.USER_C}`);
    await helpersA.assertContactUnsubscribed(`${process.env.USER_C}`);
  });

  test('User can subscribe to more than one contact', async () => {
    await helpersA.subscribeToContact(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_B}`);

    await helpersA.subscribeToContact(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_C}`);
  });

  test('Check the statuses of subscribed contacts, when one contact calls another, they receives the call and  then terminates it', async () => {
    await helpersA.subscribeToContact(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_B}`);

    await helpersA.subscribeToContact(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_C}`);

    await helpersC.callNumber(`${process.env.NUMBER_B}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus('ringing', `${process.env.USER_B}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactStatus('busy', `${process.env.USER_C}`);

    await helpersB.acceptCall();
    await helpersA.assertSubscribedContactUri(`${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus('busy', `${process.env.USER_B}`);
    await helpersA.assertSubscribedContactUri(`${process.env.USER_C}`);
    await helpersA.assertSubscribedContactStatus('busy', `${process.env.USER_C}`);

    await helpersB.terminateCall();
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_B}`);
    await helpersA.assertSubscribedContactStatus('available', `${process.env.USER_C}`);
  });
});
