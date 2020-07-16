const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click, typeText, clearText } = require('../lib/helpers');
const { USER_A, USER_B, PASSWORD_A, PASSWORD_B } = require('../config.js');

const USER_ID_INPUT = 'c-voip-account [data-selector="userIdInput"]';
const USER_PASSWORD_INPUT = 'c-voip-account [data-selector="passwordInput"]';

describe('examples', () => {
  let browser;
  let page;

  beforeEach(async function() {
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 10,
      devtools: false
    });
    page = await browser.newPage();
    await page.setDefaultTimeout(1000);
  });

  afterEach(async function() {
    await browser.close();
  });

  it('Should launch a browser', async function() {
    // Assert if the page is visible
    await page.goto('localhost:1235/demo/');
    // expect(page).to.include('c-voip-account')
    const url = await page.url();
    expect(url).to.include('/demo/');

    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, USER_A);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, PASSWORD_A);

    // Click on Register
    await click(page, 'c-voip-account [data-action="register"]');
    await page.waitFor(2000);
    await page.screenshot({ path: 'screenshots/page1.png' });

    const page2 = await browser.newPage();

    await page2.setDefaultTimeout(1000);
    await page2.goto('localhost:1235/demo/');

    await clearText(page2, USER_ID_INPUT);
    await typeText(page2, USER_ID_INPUT, USER_B);

    await clearText(page2, USER_PASSWORD_INPUT);
    await typeText(page2, USER_PASSWORD_INPUT, PASSWORD_B);

    // Click on Register
    await click(page2, 'c-voip-account [data-action="register"]');
    await page2.waitFor(2000);
    await page2.screenshot({ path: 'screenshots/page2.png' });

    // Assert if both pages are visible
    await browser.close();
  });
});
