import { Locator, Page, expect } from '@playwright/test';

export class HelpFunctions {
  readonly page: Page;
  readonly userIdInput: Locator;
  readonly passwordInput: Locator;
  readonly websocketUrlInput: Locator;
  readonly realmInput: Locator;
  readonly registerButton: Locator;
  readonly unregisterButton: Locator;
  readonly clientStatus: Locator;
  readonly dialerInput: Locator;
  readonly dialerCallButton: Locator;
  readonly sessionAcceptButton: Locator;
  readonly sessionStatus: Locator;
  readonly sessionHangupButton: Locator;
  readonly sessions: Locator;
  readonly cancelButton: Locator;
  readonly sessionRejectButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userIdInput = page.locator('[data-selector="userIdInput"]');
    this.passwordInput = page.locator('[data-selector="passwordInput"]');
    this.websocketUrlInput = page.locator('[data-selector="websocketUrlInput"]');
    this.realmInput = page.locator('[data-selector="realmInput"]');
    this.registerButton = page.locator('[data-action="register"]');
    this.unregisterButton = page.locator('[data-action="unregister"]');
    this.clientStatus = page.locator('[data-selector="clientStatus"]');
    this.dialerInput = page.locator('c-dialer [data-selector="input"]');
    this.dialerCallButton = page.locator('[data-action="call"]');
    this.sessionAcceptButton = page.locator('c-session [data-action="accept"]');
    this.sessionStatus = page.locator('c-session [data-selector="sessionStatus"]');
    this.sessionHangupButton = page.locator('c-session [data-action="hangup"]');
    this.sessions = page.locator('c-session');
    this.cancelButton = page.locator('c-session [data-action="cancel"]');
    this.sessionRejectButton = page.locator('c-session [data-action="reject"]');
  }

  async registerUser(userAuthId: string, userPw: string) {
    await this.userIdInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.userIdInput.type(userAuthId);

    await this.passwordInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.passwordInput.type(userPw);

    await this.websocketUrlInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.websocketUrlInput.type('wss://websocket.voipgrid.nl');

    await this.realmInput.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.realmInput.type('voipgrid.nl');

    await this.registerButton.click();
  }

  async unregisterUser() {
    await this.unregisterButton.click();
  }

  async assertClientConnected() {
    await expect(this.clientStatus).toHaveText('connected');
  }

  async callNumber(number: string) {
    await this.dialerInput.type(number);
    await this.dialerCallButton.click();
  }

  async acceptCall() {
    await this.sessionAcceptButton.click();
  }

  async assertCallAccepted() {
    await expect(this.sessionStatus).toHaveText('active');
  }

  async terminateCall() {
    await this.sessionHangupButton.click();
  }

  async assertCallSessionTerminated() {
    await expect(this.sessions).toHaveCount(0);
  }

  async cancelCall() {
    await this.cancelButton.click();
  }

  async rejectCall() {
    await this.sessionRejectButton.click();
  }
}
