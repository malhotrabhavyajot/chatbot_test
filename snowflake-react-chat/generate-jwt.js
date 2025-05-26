const fs = require('fs');
const jwt = require('jsonwebtoken');

// Replace with your Snowflake details
const ACCOUNT = 'wuqzvqt-dkc22677.snowflakecomputing.com';
const USER = 'MALHOTRABHAVYAJOT';
const PRIVATE_KEY_PATH = './new_rsa_key.pem';

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH);

const payload = {
  iss: ACCOUNT,
  sub: USER,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
};

const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

console.log('Generated JWT:');
console.log(token);
