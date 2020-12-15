const { errors } = require('puppeteer');
const {
  USER_ID_INPUT,
  USER_PASSWORD_INPUT,
  REALM_INPUT,
  WEBSOCKET_URL_INPUT
} = require('../helpers/constants');
const { REALM, WEBSOCKET_URL } = require('../config');

async function clearText(page, selector) {
  try {
    await page.waitForSelector(selector);
    await page.click(selector, { clickCount: 3 });
    await page.press('Backspace');
  } catch (error) {}
}

async function typeText(page, selector, text) {
  try {
    await page.waitForSelector(selector);
    await page.type(selector, text);
  } catch (error) {
    throw new Error(`Could not type into selector: ${selector}`);
  }
}

module.exports = {
  async click(page, selector) {
    try {
      await page.waitForSelector(selector);
      await page.click(selector);
    } catch (error) {
      throw new Error(`Could not click on selector: ${selector}`);
    }
  },
  async getText(page, selector) {
    try {
      await page.waitForSelector(selector);
      return page.$$eval(selector, element => element.innerHTML);
    } catch (error) {
      throw new Error(`Could not get text from selector: ${selector}`);
    }
  },
  typeText,
  async waitForText(page, selector, text) {
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
  async waitForSelector(page, selector) {
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
  clearText,
  async registerUser(page, userAuthId, userPw) {
    await clearText(page, USER_ID_INPUT);
    await typeText(page, USER_ID_INPUT, userAuthId);

    await clearText(page, USER_PASSWORD_INPUT);
    await typeText(page, USER_PASSWORD_INPUT, userPw);

    await clearText(page, WEBSOCKET_URL_INPUT);
    await typeText(page, WEBSOCKET_URL_INPUT, WEBSOCKET_URL);

    await clearText(page, REALM_INPUT);
    await typeText(page, REALM_INPUT, REALM);
  }
};
