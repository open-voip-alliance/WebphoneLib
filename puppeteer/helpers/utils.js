const { errors } = require('puppeteer');
const {
  USER_ID_INPUT,
  USER_PASSWORD_INPUT,
  PLATFORM_URL_INPUT,
  PLATFORM_HOST_INPUT
} = require('../helpers/constants');
const { PLATFORM_URL, PLATFORM_HOST } = require('../config');

module.exports = {
  click: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      await page.click(selector);
    } catch (error) {
      throw new Error(`Could not click on selector: ${selector}`);
    }
  },
  getText: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      return page.$$eval(selector, element => element.innerHTML);
    } catch (error) {
      throw new Error(`Could not get text from selector: ${selector}`);
    }
  },
  typeText: async function(page, selector, text) {
    try {
      await page.waitForSelector(selector);
      await page.type(selector, text);
    } catch (error) {
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
    } catch (error) {}
  },
  registerUser: async function(page, userAuthId, userPw) {
    await module.exports.clearText(page, USER_ID_INPUT);
    await module.exports.typeText(page, USER_ID_INPUT, userAuthId);

    await module.exports.clearText(page, USER_PASSWORD_INPUT);
    await module.exports.typeText(page, USER_PASSWORD_INPUT, userPw);

    await module.exports.clearText(page, PLATFORM_HOST_INPUT);
    await module.exports.typeText(page, PLATFORM_HOST_INPUT, PLATFORM_HOST);

    await module.exports.clearText(page, PLATFORM_URL_INPUT);
    await module.exports.typeText(page, PLATFORM_URL_INPUT, PLATFORM_URL);
  }
};
