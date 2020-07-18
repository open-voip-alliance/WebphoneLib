const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click, typeText, clearText, waitForText } = require('../lib/helpers');
const { USER_A, USER_B, PASSWORD_A, PASSWORD_B, NUMBER_A, NUMBER_B } = require('../config.js');

const NON_EXISTING_NUMBER = '989';

const USER_ID_INPUT = 'c-voip-account [data-selector="userIdInput"]';
const USER_PASSWORD_INPUT = 'c-voip-account [data-selector="passwordInput"]';

const DIALER_INPUT = 'c-dialer [data-selector="input"]';
const DIALER_CALL_BUTTON = 'c-dialer [data-action="call"]';

const REGISTER_BUTTON = 'c-voip-account [data-action="register"]';

//this works with document.querySelector so not sure why it doesn't work here
const SESSION_ACCEPT_BUTTON = 'c-session [data-action="accept"]';
const SESSION_REJECT_BUTTON = 'c-session [data-action="reject"]';
const SESSION_CANCEL_BUTTON = 'c-session [data-action="cancel"]';
const SESSION_HANGUP_BUTTON = 'c-session [data-action="hangup"]';

const SESSION_STATUS = 'c-session [data-selector="sessionStatus"]';

describe('examples', () => {
  let browser;
  let page;
  let page2;

  beforeEach(async function() {
    browser = await puppeteer.launch({
      defaultViewport: null,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--start-maximized'
      ],
      headless: false,
      slowMo: 10,
      devtools: false
    });
    const url = new URL('localhost:1235/demo/');
    page = await browser.newPage();
    page.on('pageerror', function(err) {
      theTempValue = err.toString();
      console.log('Page error: ' + theTempValue);
    });
    await page.setDefaultTimeout(500);

    page2 = await browser.newPage();
    await page2.setDefaultTimeout(500);
  });

  afterEach(async function() {
    await browser.close();
  });

  it('calling out & having the other party answer & let the other party end the call (terminate)', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    //TODO instead of using the page.waitfor everywhere let's use waitForText, e.g. account is connected!
    // Also for all the other wait fors.
    await page.waitFor(2000);

    page2.bringToFront();
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    await page2.waitFor(500);

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await page2.waitFor(500);

    // bring to front needed to be able to click
    page.bringToFront();
    await page.waitFor(1000);
    await click(page, SESSION_ACCEPT_BUTTON);

    //TODO this fails, it cannot read innerHTML of null it says.
    await waitForText(page, SESSION_STATUS, 'active');

    await page.waitFor(2000);
    await click(page, SESSION_HANGUP_BUTTON);
    //check on no c-session
  });

  it('calling out & having the other party answer & end the call yourself (terminate)', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    // maybe not so necessary but a nice example of expect.
    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(2000);

    page2.bringToFront();
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    await page2.waitFor(500);

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await page2.waitFor(500);

    // bring to front needed to be able to click
    page.bringToFront();
    await page.waitFor(1000);
    await click(page, SESSION_ACCEPT_BUTTON);
    // await waitForText(page, SESSION_STATUS, 'active');

    page2.bringToFront();
    page2.waitFor(1000);
    await click(page2, SESSION_HANGUP_BUTTON);
  });

  it('calling out & ending the call before it is answered (cancel)', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(2000);

    page2.bringToFront();
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    await page2.waitFor(500);

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await page2.waitFor(500);
    await click(page2, SESSION_CANCEL_BUTTON);
    await page2.waitFor(100);
  });

  it('calling out while other party rejects the call', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(2000);

    page2.bringToFront();
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    await page2.waitFor(500);

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await page2.waitFor(500);

    // bring to front needed to be able to click
    page.bringToFront();
    await page.waitFor(1000);
    await click(page, SESSION_REJECT_BUTTON);
  });

  it('calling out while other party is not available', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(500);

    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NUMBER_B);

    await click(page, DIALER_CALL_BUTTON);
    await page.waitFor(500);
  });

  it('calling out while other party does not exist', async function() {
    page.bringToFront();
    await page.goto('localhost:1235/demo/');

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(500);

    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NON_EXISTING_NUMBER);

    await click(page, DIALER_CALL_BUTTON);
    await page.waitFor(500);
  });
});
