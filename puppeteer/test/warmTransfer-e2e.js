const puppeteer = require('puppeteer');
const { expect } = require('chai');
const { callNumber, click, typeText, waitForText, registerUser } = require('../helpers/utils');
const {
  USER_A,
  USER_B,
  USER_C,
  PASSWORD_A,
  PASSWORD_B,
  PASSWORD_C,
  NUMBER_B,
  NUMBER_C
} = require('../config');
const {
  NON_EXISTING_NUMBER,
  DEMO_URL,
  SESSIONS,
  SESSION_ACCEPT_BUTTON,
  SESSION_UNHOLD_BUTTON,
  SESSION_REJECT_BUTTON,
  SESSION_HANGUP_BUTTON,
  SESSION_STATUS,
  SESSION_TRANSFER_BUTTON,
  SESSION_TRANSFER_METHOD_DROPDOWN,
  SESSION_WARM_TRANSFER_SELECT,
  SESSION_TRANSFER_INPUT,
  SESSION_COMPLETE_TRANSFER_BUTTON,
  CLIENT_STATUS,
  LAUNCH_OPTIONS
} = require('../helpers/constants');
const { assert } = require('sinon');

describe('Warm Transfer', () => {
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

  it('Have user A call user B and transfer user C to user B via a warm transfer in User A', async function() {
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

    await page.select(SESSION_TRANSFER_METHOD_DROPDOWN, SESSION_WARM_TRANSFER_SELECT);
    // Reminder: the demo page transfers the call after 3 seconds.
    await typeText(page, SESSION_TRANSFER_INPUT, NUMBER_C);
    await click(page, SESSION_COMPLETE_TRANSFER_BUTTON);
    expect(await page.$$(SESSIONS)).to.have.length(2);

    page3.bringToFront();
    await click(page3, SESSION_ACCEPT_BUTTON);
    // After this accept it will be the 3 seconds

    expect(await waitForText(page3, SESSION_STATUS, 'active')).to.be.true;
    expect(await page3.$$(SESSIONS)).to.have.length(1);

    page.bringToFront();
    await page.waitForTimeout(3000);
    expect(await page.$$(SESSIONS)).to.have.length(0);

    page2.bringToFront();
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;
    expect(await page2.$$(SESSIONS)).to.have.length(1);

    await click(page2, SESSION_HANGUP_BUTTON);
  });

  it('Have user A call user B and transfer user C to user B but have user C hang up and have user A activate call to B again', async function() {
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
    expect(await page2.$$(SESSIONS)).to.have.length(1);
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;

    page.bringToFront();
    expect(await page.$$(SESSIONS)).to.have.length(1);
    await click(page, SESSION_TRANSFER_BUTTON);

    await page.select(SESSION_TRANSFER_METHOD_DROPDOWN, SESSION_WARM_TRANSFER_SELECT);
    await typeText(page, SESSION_TRANSFER_INPUT, NUMBER_C);
    await click(page, SESSION_COMPLETE_TRANSFER_BUTTON);
    expect(await page.$$(SESSIONS)).to.have.length(2);

    page3.bringToFront();
    // Rejecting the incoming transfer call
    await click(page3, SESSION_REJECT_BUTTON);
    expect(await page3.$$(SESSIONS)).to.be.empty;

    // Go back to user A to "continue" the session with user B.
    page.bringToFront();
    expect(await page.$$(SESSIONS)).to.have.length(1);
    expect(await waitForText(page, SESSION_STATUS, 'on_hold')).to.be.true;
    await click(page, SESSION_UNHOLD_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;
    await click(page, SESSION_HANGUP_BUTTON);
  });

  it('Have user A call user B and transfer B to a non existing number', async function() {
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    await callNumber(page, NUMBER_B);

    page2.bringToFront();
    await click(page2, SESSION_ACCEPT_BUTTON);
    expect(await page2.$$(SESSIONS)).to.have.length(1);
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;

    page.bringToFront();
    expect(await page.$$(SESSIONS)).to.have.length(1);
    await click(page, SESSION_TRANSFER_BUTTON);

    await page.select(SESSION_TRANSFER_METHOD_DROPDOWN, SESSION_WARM_TRANSFER_SELECT);
    await typeText(page, SESSION_TRANSFER_INPUT, NON_EXISTING_NUMBER);
    await click(page, SESSION_COMPLETE_TRANSFER_BUTTON);
    expect(await page.$$(SESSIONS)).to.have.length(2);

    // session will get rejected so lets wait a bit for that
    await page.waitForTimeout(5000);

    expect(await page.$$(SESSIONS)).to.have.length(1);
    expect(await waitForText(page, SESSION_STATUS, 'on_hold')).to.be.true;
    await click(page, SESSION_UNHOLD_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;
    await click(page, SESSION_HANGUP_BUTTON);
  });
});
