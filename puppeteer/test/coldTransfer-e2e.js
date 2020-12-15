const puppeteer = require('puppeteer');
const { expect } = require('chai');
const {
  callNumber,
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
  REGISTER_BUTTON,
  SESSIONS_LIST,
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

  it('Have user A call user B and transfer user B to user C via a cold transfer in User A', async function() {
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    page3.bringToFront();
    await page3.goto(DEMO_URL);

    await registerUser(page3, USER_C, PASSWORD_C);
    expect(await waitForText(page3, CLIENT_STATUS, 'connected')).to.be.true;

    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    await callNumber(page, NUMBER_B);

    page2.bringToFront();
    await click(page2, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;

    page.bringToFront();
    await click(page, SESSION_TRANSFER_BUTTON);

    await page.select(SESSION_TRANSFER_METHOD_DROPDOWN, SESSION_COLD_TRANSFER_SELECT);
    await typeText(page, SESSION_TRANSFER_INPUT, NUMBER_C);
    await click(page, SESSION_COMPLETE_TRANSFER_BUTTON);
    expect(await waitForSelector(page, SESSIONS_LIST)).to.be.empty;

    page3.bringToFront();
    await click(page3, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page3, SESSION_STATUS, 'active')).to.be.true;

    page2.bringToFront();
    await click(page2, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;
  });

  xit('Have user A call user B and transfer user C to user B', async function() {
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

  xit('Have user A call user B and transfer user C to user B but have user C hang up and let user A accept ringback', async function() {
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

  xit('Have user A call user B and transfer user C to user B', async function() {
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
