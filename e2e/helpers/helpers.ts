import { Locator, Page, expect } from '@playwright/test';

type SessionStatus = 'ringing' | 'active' | 'on_hold';

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
  readonly sessions: Locator;
  readonly sessionStatus: Locator;
  readonly sessionHangupButton: Locator;
  readonly sessionCancelButton: Locator;
  readonly sessionRejectButton: Locator;
  readonly sessionUnholdButton: Locator;
  readonly sessionTransferButton: Locator;
  readonly sessionTransferMethodDropdown: Locator;
  readonly sessionTransferInput: Locator;
  readonly sessionCompleteTransferButton: Locator;

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
    this.sessions = page.locator('c-sessions c-session');
    this.sessionStatus = page.locator('c-session [data-selector="sessionStatus"]');
    this.sessionHangupButton = page.locator('c-session [data-action="hangup"]');
    this.sessionCancelButton = page.locator('c-session [data-action="cancel"]');
    this.sessionRejectButton = page.locator('c-session [data-action="reject"]');
    this.sessionUnholdButton = page.locator('c-session [data-action="unhold"]');
    this.sessionTransferButton = page.locator('c-session [data-action="toggleTransfer"]');
    this.sessionTransferMethodDropdown = page.locator(
      'c-transfer [data-selector="selectTransferMethod"]'
    );
    this.sessionTransferInput = page.locator('c-transfer [data-selector="input"]');
    this.sessionCompleteTransferButton = page.locator('c-transfer [data-action="transferCall"]');
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

  async assertSessionExists() {
    await expect(this.sessions).toHaveCount(1);
  }

  async assertTwoActiveSessions() {
    await expect(this.sessions).toHaveCount(2);
  }

  async acceptCall() {
    await this.sessionAcceptButton.click();
  }

  async assertSessionStatus(status: SessionStatus) {
    await expect(this.sessionStatus).toHaveText(status);
  }

  async assertFirstSessionStatus(status: SessionStatus) {
    await expect(this.sessionStatus.nth(0)).toHaveCount(1);
    await expect(this.sessionStatus.nth(0)).toHaveText(status);
  }

  async assertSecondSessionStatus(status: SessionStatus) {
    await expect(this.sessionStatus.nth(1)).toHaveCount(1);
    await expect(this.sessionStatus.nth(1)).toHaveText(status);
  }

  async terminateCall() {
    await this.sessionHangupButton.click();
  }

  async assertSessionTerminated() {
    await expect(this.sessions).toHaveCount(0);
  }

  async cancelCall() {
    await this.sessionCancelButton.click();
  }

  async rejectCall() {
    await this.sessionRejectButton.click();
  }

  async unholdCall() {
    await this.sessionUnholdButton.click();
  }

  async clickTransferButton() {
    await this.sessionTransferButton.click();
  }

  async coldTransferCall(number: string) {
    await this.sessionTransferMethodDropdown.selectOption('blind');
    await this.sessionTransferInput.type(number);
    await this.sessionCompleteTransferButton.click();
  }

  async warmTransferCall(number: string) {
    await this.sessionTransferMethodDropdown.selectOption('attended');
    await this.sessionTransferInput.type(number);
    await this.sessionCompleteTransferButton.click();
  }
}
