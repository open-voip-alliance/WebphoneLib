module.exports = {
  NON_EXISTING_NUMBER: '989',
  DEMO_URL: 'http://localhost:1235/demo/',
  LAUNCH_OPTIONS: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--start-maximized'
    ],
    headless: false,
    slowMo: 10,
    devtools: false,
    timeout: 0,
    defaultViewport: null
  },
  USER_ID_INPUT: 'c-voip-account [data-selector="userIdInput"]',
  USER_PASSWORD_INPUT: 'c-voip-account [data-selector="passwordInput"]',
  DIALER_INPUT: 'c-dialer [data-selector="input"]',
  DIALER_CALL_BUTTON: 'c-dialer [data-action="call"]',
  REGISTER_BUTTON: 'c-voip-account [data-action="register"]',
  SESSION_ACCEPT_BUTTON: 'c-session [data-action="accept"]',
  SESSION_REJECT_BUTTON: 'c-session [data-action="reject"]',
  SESSION_CANCEL_BUTTON: 'c-session [data-action="cancel"]',
  SESSION_HANGUP_BUTTON: 'c-session [data-action="hangup"]',
  SESSION_STATUS: 'c-session [data-selector="sessionStatus"]',
  CLIENT_STATUS: '[data-selector="clientStatus"]'
};
