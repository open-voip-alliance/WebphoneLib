const { errors } = require('puppeteer');

const {
  USER_ID_INPUT,
  USER_PASSWORD_INPUT,
  REALM_INPUT,
  WEBSOCKET_URL_INPUT
} = require('../helpers/constants');
const { REALM, WEBSOCKET_URL } = require('../config');

const screenshotDirectory = '/home/pptruser/pictures/';

module.exports = {
  click: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      await page.click(selector);
    } catch (error) {
      await page.screenshot({ path: `${screenshotDirectory}clickError.jpg`, type: 'jpeg' });
      throw new Error(`Could not click on selector: ${selector}`);
    }
  },
  getText: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      return page.$$eval(selector, element => element.innerHTML);
    } catch (error) {
      await page.screenshot({ path: `${screenshotDirectory}getTextError.jpg`, type: 'jpeg' });
      throw new Error(`Could not get text from selector: ${selector}`);
    }
  },
  typeText: async function(page, selector, text) {
    try {
      await page.waitForSelector(selector);
      await page.type(selector, text);
    } catch (error) {
      await page.screenshot({ path: `${screenshotDirectory}typeTextError.jpg`, type: 'jpeg' });
      throw new Error(`Could not type into selector: ${selector}`);
    }
  },
  waitForText: async function(page, selector, text) {
    let node;
    try {
      node = await page.waitForSelector(selector);
    } catch (err) {
      if (err instanceof errors.TimeoutError) {
        throw new Error(`Timeout waiting for selector: "${selector}"`);
      }
      throw err;
    }

    let isFound;
    try {
      isFound = await page.waitForFunction(
        (node, text) => {
          if (node && node.innerText.includes(text)) {
            return true;
          }
          return false;
        },
        {},
        node,
        text
      );
    } catch (err) {
      await page.screenshot({
        path: `${screenshotDirectory}waitForTextError.jpg`,
        type: 'jpeg'
      });
      if (err instanceof errors.TimeoutError) {
        throw new Error(`Timeout while retrying to find "${text}" in selector "${selector}"`);
      }
      throw err;
    }

    return isFound.jsonValue();
  },
  waitForSelector: async function(page, selector) {
    let node;
    try {
      node = await page.waitForSelector(selector);
    } catch (err) {
      await page.screenshot({
        path: `${screenshotDirectory}waitForSelectorError.jpg`,
        type: 'jpeg'
      });
      if (err instanceof errors.TimeoutError) {
        throw new Error(`Timeout waiting for selector: "${selector}"`);
      }
      throw err;
    }

    return node.jsonValue();
  },
  clearText: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      await page.click(selector, { clickCount: 3 });
      await page.press('Backspace');
    } catch (error) {
      await page.screenshot({
        path: `${screenshotDirectory}clearTextError.jpg`,
        type: 'jpeg'
      });
    }
  },
  registerUser: async function(page, userAuthId, userPw) {
    await module.exports.clearText(page, USER_ID_INPUT);
    await module.exports.typeText(page, USER_ID_INPUT, userAuthId);

    await module.exports.clearText(page, USER_PASSWORD_INPUT);
    await module.exports.typeText(page, USER_PASSWORD_INPUT, userPw);

    await module.exports.clearText(page, WEBSOCKET_URL_INPUT);
    await module.exports.typeText(page, WEBSOCKET_URL_INPUT, WEBSOCKET_URL);

    await module.exports.clearText(page, REALM_INPUT);
    await module.exports.typeText(page, REALM_INPUT, REALM);
  }
};
