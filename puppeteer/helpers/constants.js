import dotenv from 'dotenv';

dotenv.config();

export const NON_EXISTING_NUMBER = '989';
export const DEMO_URL = process.env.DEMO_URL;
export const LAUNCH_OPTIONS = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream'
  ],
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
  ignoreHTTPSErrors: true,
  headless: 'new',
  timeout: 0
};
export const USER_ID_INPUT = 'c-voip-account [data-selector="userIdInput"]';
export const USER_PASSWORD_INPUT = 'c-voip-account [data-selector="passwordInput"]';
export const WEBSOCKET_URL_INPUT = 'c-voip-account [data-selector="websocketUrlInput"]';
export const REALM_INPUT = 'c-voip-account [data-selector="realmInput"]';
export const DIALER_INPUT = 'c-dialer [data-selector="input"]';
export const DIALER_CALL_BUTTON = 'c-dialer [data-action="call"]';
export const REGISTER_BUTTON = 'c-voip-account [data-action="register"]';
export const UNREGISTER_BUTTON = 'c-voip-account [data-action="unregister"]';
export const SESSION_ACCEPT_BUTTON = 'c-session [data-action="accept"]';
export const SESSION_UNHOLD_BUTTON = 'c-session [data-action="unhold"]';
export const SESSION_REJECT_BUTTON = 'c-session [data-action="reject"]';
export const SESSION_CANCEL_BUTTON = 'c-session [data-action="cancel"]';
export const SESSION_HANGUP_BUTTON = 'c-session [data-action="hangup"]';
export const SESSION_TRANSFER_BUTTON = 'c-session [data-action="toggleTransfer"]';
export const SESSION_TRANSFER_METHOD_DROPDOWN = 'c-transfer [data-selector="selectTransferMethod"]';
export const SESSION_COLD_TRANSFER_SELECT = 'blind';
export const SESSION_WARM_TRANSFER_SELECT = 'attended';
export const SESSION_TRANSFER_INPUT = 'c-transfer [data-selector="input"]';
export const SESSION_COMPLETE_TRANSFER_BUTTON = 'c-transfer [data-action="transferCall"]';
export const SESSION_STATUS = 'c-session [data-selector="sessionStatus"]';
export const SESSIONS_LIST = '[data-selector="sessionsList"]';
export const SESSIONS = 'c-session';
export const CLIENT_STATUS = '[data-selector="clientStatus"]';
