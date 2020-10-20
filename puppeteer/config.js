const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  USER_A: process.env.USER_A,
  USER_B: process.env.USER_B,
  PASSWORD_A: process.env.PASSWORD_A,
  PASSWORD_B: process.env.PASSWORD_B,
  NUMBER_A: process.env.NUMBER_A,
  NUMBER_B: process.env.NUMBER_B,
  PLATFORM_URL: process.env.PLATFORM_URL
};
