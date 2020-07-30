const { errors } = require('puppeteer');

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
  }
};
