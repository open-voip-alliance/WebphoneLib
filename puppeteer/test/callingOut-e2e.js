import puppeteer from 'puppeteer';
import { expect } from 'chai';
import { describe, beforeEach, afterEach, it } from 'mocha';

import { callNumber, click, waitForText, registerUser, delay } from '../helpers/utils.js';
import { USER_A, USER_B, PASSWORD_A, PASSWORD_B, NUMBER_A, NUMBER_B } from '../config.js';
import {
  NON_EXISTING_NUMBER,
  DEMO_URL,
  SESSIONS,
  SESSION_ACCEPT_BUTTON,
  SESSION_REJECT_BUTTON,
  SESSION_CANCEL_BUTTON,
  SESSION_HANGUP_BUTTON,
  SESSION_STATUS,
  CLIENT_STATUS,
  LAUNCH_OPTIONS
} from '../helpers/constants.js';

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
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    await callNumber(page2, NUMBER_A);

    page.bringToFront();
    await click(page, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;

    await click(page, SESSION_HANGUP_BUTTON);
  });

  it('calling out & having the other party answer & end the call yourself (terminate)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from page2 to the other one
    await callNumber(page2, NUMBER_A);

    // accept the call on the first page
    page.bringToFront();
    await click(page, SESSION_ACCEPT_BUTTON);
    expect(await waitForText(page, SESSION_STATUS, 'active')).to.be.true;

    // end the call from the second page
    page2.bringToFront();
    // Wait for page2's session to also be active before hanging up
    expect(await waitForText(page2, SESSION_STATUS, 'active')).to.be.true;
    await click(page2, SESSION_HANGUP_BUTTON);
  });

  it('calling out & ending the call before it is answered (cancel)', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from the second page
    await callNumber(page2, NUMBER_A);

    // Wait for the session element to appear with session status
    await page2.waitForSelector(SESSION_STATUS, { timeout: 10000 });
    await delay(200); // Small delay to ensure cancel button is ready

    // and end the call when we can
    await click(page2, SESSION_CANCEL_BUTTON);
    await delay(100);
  });

  it('calling out while other party rejects the call', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Register on the second page
    page2.bringToFront();
    await page2.goto(DEMO_URL);

    await registerUser(page2, USER_B, PASSWORD_B);
    expect(await waitForText(page2, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call from the second page
    await callNumber(page2, NUMBER_A);

    // Reject the call from the first page
    page.bringToFront();
    // Wait for the incoming session element to appear
    await page.waitForSelector(SESSIONS, { timeout: 10000 });
    await delay(100); // Small delay to ensure button is clickable
    await click(page, SESSION_REJECT_BUTTON);
  });

  it('calling out while other party is not available', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // setup a call to the non-logged in account
    await callNumber(page, NUMBER_B);

    // Wait for the session to be cleaned up after unavailable response
    await page.waitForFunction(
      selector => {
        const sessions = document.querySelectorAll(selector);
        return sessions.length === 0;
      },
      { timeout: 10000 },
      SESSIONS
    );

    expect(await page.$$(SESSIONS)).to.have.length(0);
  });

  it('calling out while other party does not exist', async function() {
    page.bringToFront();
    await page.goto(DEMO_URL);

    const url = await page.url();
    expect(url).to.include('/demo/');

    // Register on the first page
    await registerUser(page, USER_A, PASSWORD_A);
    expect(await waitForText(page, CLIENT_STATUS, 'connected')).to.be.true;

    // Setup a call to an internal number we know does not exist
    await callNumber(page, NON_EXISTING_NUMBER);

    // Wait for the session to be cleaned up after not found response
    await page.waitForFunction(
      selector => {
        const sessions = document.querySelectorAll(selector);
        return sessions.length === 0;
      },
      { timeout: 10000 },
      SESSIONS
    );

    expect(await page.$$(SESSIONS)).to.have.length(0);
  });
});
