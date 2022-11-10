const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  NON_EXISTING_NUMBER: '989',
  DEMO_URL: process.env.DEMO_URL,
  LAUNCH_OPTIONS: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--start-maximized',
      '--unsafely-treat-insecure-origin-as-secure=http://web:1235'
    ],
    dumpio: false,
    ignoreHTTPSErrors: true,
    headless: true,
    devtools: false,
    slowMo: 10,
    timeout: 0,
    defaultViewport: null
  },
  USER_ID_INPUT: 'c-voip-account [data-selector="userIdInput"]',
  USER_PASSWORD_INPUT: 'c-voip-account [data-selector="passwordInput"]',
  WEBSOCKET_URL_INPUT: 'c-voip-account [data-selector="websocketUrlInput"]',
  REALM_INPUT: 'c-voip-account [data-selector="realmInput"]',
  DIALER_INPUT: 'c-dialer [data-selector="input"]',
  DIALER_CALL_BUTTON: 'c-dialer [data-action="call"]',
  REGISTER_BUTTON: 'c-voip-account [data-action="register"]',
  SESSION_ACCEPT_BUTTON: 'c-session [data-action="accept"]',
  SESSION_UNHOLD_BUTTON: 'c-session [data-action="unhold"]',
  SESSION_REJECT_BUTTON: 'c-session [data-action="reject"]',
  SESSION_CANCEL_BUTTON: 'c-session [data-action="cancel"]',
  SESSION_HANGUP_BUTTON: 'c-session [data-action="hangup"]',
  SESSION_TRANSFER_BUTTON: 'c-session [data-action="toggleTransfer"]',
  SESSION_TRANSFER_METHOD_DROPDOWN: 'c-transfer [data-selector="selectTransferMethod"]',
  SESSION_COLD_TRANSFER_SELECT: 'blind',
  SESSION_WARM_TRANSFER_SELECT: 'attended',
  SESSION_TRANSFER_INPUT: 'c-transfer [data-selector="input"]',
  SESSION_COMPLETE_TRANSFER_BUTTON: 'c-transfer [data-action="transferCall"]',
  SESSION_STATUS: 'c-session [data-selector="sessionStatus"]',
  SESSIONS_LIST: '[data-selector="sessionsList"]',
  SESSIONS: 'c-session',
  CLIENT_STATUS: '[data-selector="clientStatus"]'
};
