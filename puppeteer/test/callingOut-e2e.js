const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click, typeText, clearText, waitForText, waitForSelector } = require('../lib/helpers');
const { USER_A, USER_B, PASSWORD_A, PASSWORD_B, NUMBER_A, NUMBER_B } = require('../config.js');

const NON_EXISTING_NUMBER = '989';
const DEMO_URL = 'http://localhost:1235/demo/';

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
const CLIENT_STATUS = '[data-selector="clientStatus"]';

describe('examples', () => {
  let browser;
  let page;
  let page2;

  beforeEach(async function() {
    browser = await puppeteer.launch({
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--start-maximized'
      ],
      headless: false,
      slowMo: 10,
      devtools: false,
      timeout: 0,
      defaultViewport: null
    });

    page = await browser.newPage();
    page.on('pageerror', function(err) {
      console.log(`Page error: ${err.toString()}`);
    });
    // await page.setDefaultTimeout(0);

    page2 = await browser.newPage();
    // await page2.setDefaultTimeout(0);
  });

  afterEach(async function() {
    await browser.close();
  });

  it('calling out & having the other party answer & let the other party end the call (terminate)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

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

    // maybe not so necessary but a nice example of expect.
    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);

    page.bringToFront();
    await waitForSelector(page, SESSION_ACCEPT_BUTTON);
    await click(page, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;

    page2.bringToFront();
    await waitForSelector(page, SESSION_HANGUP_BUTTON);
    await click(page2, SESSION_HANGUP_BUTTON);
  });

  it('calling out & ending the call before it is answered (cancel)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await waitForSelector(page, SESSION_CANCEL_BUTTON);
    await click(page2, SESSION_CANCEL_BUTTON);
    await page2.waitFor(100);
  });

  it('calling out while other party rejects the call', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);

    page.bringToFront();
    await waitForSelector(page, SESSION_REJECT_BUTTON);
    await click(page, SESSION_REJECT_BUTTON);
  });

  it('calling out while other party is not available', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

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

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NON_EXISTING_NUMBER);

    await click(page, DIALER_CALL_BUTTON);
    await page.waitFor(500);
  });
});
