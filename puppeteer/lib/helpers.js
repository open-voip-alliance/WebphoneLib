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
      return await page.$$eval(selector, element => element.innerHTML);
    } catch (error) {
      throw new Error(`Could not get text from selector: ${selector}`);
    }
  },
  typeText: async function(page, selector, text) {
    try {
      await page.waitForSelector(selector);
      await page.type(selector, text);
    } catch (error) {
      console.log(error);
      throw new Error(`Could not type into selector: ${selector}`);
    }
  },
  waitForText: async function(page, selector, text) {
    try {
      await page.waitForSelector(selector);
      await page.waitForFunction((selector, text) => {
        document.querySelector(selector).innerHTML.includes(text), {}, selector, text;
      });
    } catch (error) {
      throw new Error(`Could not find ${text} for selector: ${selector}`);
    }
  },
  clearText: async function(page, selector) {
    try {
      await page.waitForSelector(selector);
      await page.click(selector, { clickCount: 3 });
      await page.press('Backspace');
    } catch (error) {}
  }
};
