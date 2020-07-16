const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click, typeText, clearText } = require('../lib/helpers');
const { USER_A, USER_B, PASSWORD_A, PASSWORD_B, NUMBER_A, NUMBER_B } = require('../config.js');
const { UrlMapping } = require('typedoc');

const USER_ID_INPUT = 'c-voip-account [data-selector="userIdInput"]';
const USER_PASSWORD_INPUT = 'c-voip-account [data-selector="passwordInput"]';

const DIALER_INPUT = 'c-dialer [data-selector="input"]';
const DIALER_CALL_BUTTON = 'c-dialer [data-action="call"]';

const REGISTER_BUTTON = 'c-voip-account [data-action="register"]';

describe('examples', () => {
  let browser;
  let page;
  let context;

  beforeEach(async function() {
    browser = await puppeteer.launch({
      args: ['--use-fake-device-for-media-stream'],
      headless: false,
      slowMo: 10,
      devtools: false
    });
    const url = new URL('localhost:1235/demo/');
    context = browser.defaultBrowserContext();
    context.overridePermissions(url.origin, ['microphone']);
    page = await context.newPage();
    page.on('error', msg => console.log('PAGE LOG:', msg));
    await page.setDefaultTimeout(1000);
  });

  afterEach(async function() {
    await browser.close();
  });

  it('Should launch a browser', async function() {
    // Assert if the page is visible
    await page.goto('localhost:1235/demo/');

    const granted = await page.evaluate(async () => {
      return (await navigator.permissions.query({ name: 'microphone' })).state;
    });
    console.log('Granted:', granted);
    // expect(page).to.include('c-voip-account')
    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(2000);
    await page.screenshot({ path: 'screenshots/page1.png', fullPage: true });

    const page2 = await context.newPage();
    page2.on('console', msg => console.log('PAGE LOG:', msg.text));

    await page2.setDefaultTimeout(500);
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, REGISTER_BUTTON);
    await page2.waitFor(500);
    await page2.screenshot({ path: 'screenshots/page2.png', fullPage: true });

    await clearText(page2, DIALER_INPUT);
    await typeText(page2, DIALER_INPUT, NUMBER_A);

    await click(page2, DIALER_CALL_BUTTON);
    await page2.waitFor(500);
    await page2.screenshot({ path: 'screenshots/page_call_2.png', fullPage: true });
    await page.waitFor(2000);

    await page.screenshot({ path: 'screenshots/page_call.png', fullPage: true });
  });
});
