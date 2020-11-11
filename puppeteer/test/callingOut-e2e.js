const puppeteer = require('puppeteer');
const { expect } = require('chai');
const {
  click,
  typeText,
  clearText,
  waitForText,
  waitForSelector,
  registerUser
} = require('../helpers/utils');
const { USER_A, USER_B, PASSWORD_A, PASSWORD_B, NUMBER_A, NUMBER_B } = require('../config');
const {
  NON_EXISTING_NUMBER,
  DEMO_URL,
  DIALER_INPUT,
  DIALER_CALL_BUTTON,
  REGISTER_BUTTON,
  SESSION_ACCEPT_BUTTON,
  SESSION_REJECT_BUTTON,
  SESSION_CANCEL_BUTTON,
  SESSION_HANGUP_BUTTON,
  SESSION_STATUS,
  CLIENT_STATUS,
  LAUNCH_OPTIONS
} = require('../helpers/constants');

describe('Calling out', () => {
  let browser;
  let page;
  let page2;

  beforeEach(async function() {
    browser = await puppeteer.launch(LAUNCH_OPTIONS);

    page = await browser.newPage();
    page.on('pageerror', function(err) {
      console.log(`Page error: ${err.toString()}`);
    });

    page2 = await browser.newPage();
  });

  afterEach(async function() {
    await browser.close();
  });

  it('calling out & having the other party answer & let the other party end the call (terminate)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);

    page.bringToFront();
    await waitForSelector(page, SESSION_ACCEPT_BUTTON);
    await click(page, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;

    await waitForSelector(page, SESSION_HANGUP_BUTTON);
    await click(page, SESSION_HANGUP_BUTTON);
  });

  it('calling out & having the other party answer & end the call yourself (terminate)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from page2 to the other one
    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);
    await click(page2, DIALER_CALL_BUTTON);

    // accept the call on the first page
    page.bringToFront();
    await waitForSelector(page, SESSION_ACCEPT_BUTTON);
    await click(page, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;

    // end the call from the second page
    page2.bringToFront();
    await waitForSelector(page, SESSION_HANGUP_BUTTON);
    await click(page2, SESSION_HANGUP_BUTTON);
  });

  it('calling out & ending the call before it is answered (cancel)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from the second page
    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);
    await click(page2, DIALER_CALL_BUTTON);

    // and end the call when we can
    await waitForSelector(page, SESSION_CANCEL_BUTTON);
    await click(page2, SESSION_CANCEL_BUTTON);
    await page2.waitFor(100);
  });

  it('calling out while other party rejects the call', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from the second page
    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);
    await click(page2, DIALER_CALL_BUTTON);

    // Reject the call from the first page
    page.bringToFront();
    await waitForSelector(page, SESSION_REJECT_BUTTON);
    await click(page, SESSION_REJECT_BUTTON);
  });

  it('calling out while other party is not available', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call to the non-logged in account
    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NUMBER_B);

    await click(page, DIALER_CALL_BUTTON);
    await page.waitFor(500);
  });

  it('calling out while other party does not exist', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Setup a call to an internal number we know does not exist
    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NON_EXISTING_NUMBER);

    await click(page, DIALER_CALL_BUTTON);
    await page.waitFor(500);
  });
});
