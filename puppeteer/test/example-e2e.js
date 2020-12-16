const puppeteer = require('puppeteer');
const expect = require('chai').expect;
const { click } = require('../helpers/utils');
const { REGISTER_BUTTON, DEMO_URL, LAUNCH_OPTIONS } = require('../helpers/constants');

describe.skip('examples', () => {
  let browser;
  let page;

  beforeEach(async function() {
    browser = await puppeteer.launch(LAUNCH_OPTIONS);
    page = await browser.newPage();
  });

  afterEach(async function() {
    await browser.close();
  });

  it('Should launch a browser', async function() {
    // Assert if the page is visible
    await page.goto(DEMO_URL);
    // expect(page).to.include('c-voip-account')
    const url = await page.url();
    expect(url).to.include('/demo/');

    // Click on Register
    await click(page, REGISTER_BUTTON);
    await page.waitFor(2000);
  });

  it('Should be possible to launch two browser pages', async function() {
    // Launch a second browser
    let browser2;
    let page2;
    browser2 = await puppeteer.launch(LAUNCH_OPTIONS);
    page2 = await browser2.newPage();
    await page2.setDefaultTimeout(1000);
    await page2.goto(DEMO_URL);

    // Assert if both pages are visible
    await browser2.close();
  });
});
