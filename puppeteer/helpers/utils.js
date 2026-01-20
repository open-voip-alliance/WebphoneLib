import puppeteer from 'puppeteer';
import {
  USER_ID_INPUT,
  USER_PASSWORD_INPUT,
  REALM_INPUT,
  WEBSOCKET_URL_INPUT,
  REGISTER_BUTTON,
  UNREGISTER_BUTTON,
  DIALER_INPUT,
  DIALER_CALL_BUTTON,
  CLIENT_STATUS
} from '../helpers/constants.js';
import { REALM, WEBSOCKET_URL } from '../config.js';

const { errors } = puppeteer;

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

export async function click(page, selector) {
  try {
    await page.waitForSelector(selector);
    await page.click(selector);
  } catch (error) {
    throw new Error(`Could not click on selector: ${selector}`);
  }
}

export async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getText(page, selector) {
  try {
    await page.waitForSelector(selector);
    return page.$$eval(selector, element => element.innerHTML);
  } catch (error) {
    throw new Error(`Could not get text from selector: ${selector}`);
  }
}

export { typeText };

export async function waitForText(page, selector, text) {
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
}

export { clearText };

export async function registerUser(page, userAuthId, userPw) {
  await clearText(page, USER_ID_INPUT);
  await typeText(page, USER_ID_INPUT, userAuthId);

  await clearText(page, USER_PASSWORD_INPUT);
  await typeText(page, USER_PASSWORD_INPUT, userPw);

  await clearText(page, WEBSOCKET_URL_INPUT);
  await typeText(page, WEBSOCKET_URL_INPUT, WEBSOCKET_URL);

  await clearText(page, REALM_INPUT);
  await typeText(page, REALM_INPUT, REALM);

  await click(page, REGISTER_BUTTON);
}

export async function cleanupUser(page) {
  try {
    // Check if page is still accessible
    if (!page || page.isClosed()) {
      return;
    }

    // First, terminate any active sessions
    const sessions = await page.$$('c-session [data-action="hangup"]').catch(() => []);
    for (const sessionHangup of sessions) {
      try {
        await sessionHangup.click();
        await delay(100);
      } catch (e) {
        // Ignore individual session cleanup errors
      }
    }

    // Wait a bit for sessions to fully terminate
    if (sessions.length > 0) {
      await delay(500);
    }

    // Only unregister if we're actually connected
    const statusElement = await Promise.race([
      page.$(CLIENT_STATUS),
      new Promise(resolve => setTimeout(() => resolve(null), 1000))
    ]);

    if (statusElement) {
      const status = await page.evaluate(el => el.textContent, statusElement).catch(() => '');
      if (status && status.includes('connected')) {
        // Try to click unregister button with a short timeout
        const unregisterButton = await Promise.race([
          page.waitForSelector(UNREGISTER_BUTTON, { timeout: 2000 }),
          new Promise(resolve => setTimeout(() => resolve(null), 2000))
        ]);

        if (unregisterButton) {
          await unregisterButton.click();
          // Wait a bit for unregister to complete
          await delay(300);
        }
      }
    }
  } catch (error) {
    // Silently ignore cleanup errors - this is best effort
  }
}

// Alias for backwards compatibility
export const unregisterUser = cleanupUser;

export async function callNumber(page, number) {
  await clearText(page, DIALER_INPUT);
  await typeText(page, DIALER_INPUT, number);
  await click(page, DIALER_CALL_BUTTON);
}
