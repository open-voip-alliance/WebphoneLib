const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click } = require('../lib/helpers');

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

  it('Should lauch a browser', async function() {
    // Assert if the page is visible
    await page.goto('localhost:1235/demo/');
    // expect(page).to.include('c-voip-account')
    const url = await page.url();
    expect(url).to.include('/demo/');

    // Click on Register
    await click(page, 'c-voip-account [data-action="register"]');
    await page.waitFor(2000);
  });

  it('Should be possible to launch two browser pages', async function() {
    // Launch a second browser
    let browser2;
    let page2;
    browser2 = await puppeteer.launch({
      headless: false,
      slowMo: 10,
      devtools: false
    });
    page2 = await browser2.newPage();
    await page2.setDefaultTimeout(1000);
    await page2.goto('localhost:1235/demo/');

    // Assert if both pages are visible
    await browser2.close();
  });
});
