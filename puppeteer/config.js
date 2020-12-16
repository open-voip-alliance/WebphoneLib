const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  USER_A: process.env.USER_A,
  USER_B: process.env.USER_B,
  USER_C: process.env.USER_C,
  PASSWORD_A: process.env.PASSWORD_A,
  PASSWORD_B: process.env.PASSWORD_B,
  PASSWORD_C: process.env.PASSWORD_C,
  NUMBER_A: process.env.NUMBER_A,
  NUMBER_B: process.env.NUMBER_B,
  NUMBER_C: process.env.NUMBER_C,
  WEBSOCKET_URL: process.env.WEBSOCKET_URL,
  REALM: process.env.REALM
};
