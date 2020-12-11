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
const {
  USER_A,
  USER_B,
  USER_C,
  PASSWORD_A,
  PASSWORD_B,
  PASSWORD_C,
  NUMBER_A,
  NUMBER_B,
  NUMBER_C
} = require('../config');
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
  SESSION_TRANSFER_BUTTON,
  SESSION_TRANSFER_METHOD_DROPDOWN,
  SESSION_COLD_TRANSFER_SELECT,
  SESSION_TRANSFER_INPUT,
  SESSION_COMPLETE_TRANSFER_BUTTON,
  CLIENT_STATUS,
  LAUNCH_OPTIONS
} = require('../helpers/constants');

describe('Cold Transfer', () => {
  let browser;
  let page;
  let page2;
  let page3;

  beforeEach(async function() {
    browser = await puppeteer.launch(LAUNCH_OPTIONS);

    page = await browser.newPage();
    page.on('pageerror', function(err) {
      console.log(`Page error: ${err.toString()}`);
    });

    page2 = await browser.newPage();
    page3 = await browser.newPage();
  });

  afterEach(async function() {
    await browser.close();
  });

  it('Have user A call user B and transfer user C to user B', async function() {
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    await click(page2, REGISTER_BUTTON);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    page3.bringToFront();
    await page3.goto(DEMO_URL);

    await registerUser(page3, USER_C, PASSWORD_C);
    await click(page3, REGISTER_BUTTON);
    expect(await waitForText(page3, CLIENT_STATUS, 'connected')).to.be.true;

    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await registerUser(page, USER_A, PASSWORD_A);
    await click(page, REGISTER_BUTTON);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    await clearText(page, DIALER_INPUT);
    await typeText(page, DIALER_INPUT, NUMBER_B);

    page2.bringToFront();
    await waitForSelector(page2, SESSION_ACCEPT_BUTTON);
    await click(page2, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;

    page.bringToFront();
    await waitForSelector(page, SESSION_TRANSFER_BUTTON);
    await click(page, SESSION_TRANSFER_BUTTON);

    //TODO select blind transfer from dropdown menu.
  });

  it('Have user A call user B and transfer user C to user B', async function() {
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

    page3.bringToFront();
    await page3.goto(DEMO_URL);

    await registerUser(page3, USER_C, PASSWORD_C);
    await click(page3, REGISTER_BUTTON);
    expect(await waitForText(page3, CLIENT_STATUS, 'connected')).to.be.true;
  });

  it('Have user A call user B and transfer user C to user B but have user C hang up and let user A accept ringback', async function() {
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

    page3.bringToFront();
    await page3.goto(DEMO_URL);

    await registerUser(page3, USER_C, PASSWORD_C);
    await click(page3, REGISTER_BUTTON);
    expect(await waitForText(page3, CLIENT_STATUS, 'connected')).to.be.true;
  });

  it('Have user A call user B and transfer user C to user B', async function() {
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

    page3.bringToFront();
    await page3.goto(DEMO_URL);

    await registerUser(page3, USER_C, PASSWORD_C);
    await click(page3, REGISTER_BUTTON);
    expect(await waitForText(page3, CLIENT_STATUS, 'connected')).to.be.true;
  });
});
