const jwt = require('jsonwebtoken');
const fs = require('fs');

// === CONFIGURE THESE ===
const SNOWFLAKE_ACCOUNT = "WUQZVQT-DKC22677";         // Your Snowflake account identifier (see Snowflake UI)
const SNOWFLAKE_USER = "MALHOTRABHAVYAJOT";         // The user you’re authenticating as (all UPPERCASE by default!)
const PRIVATE_KEY_PATH = "./private_key.pem";              // Path to your PRIVATE key (generated with openssl)
// const PRIVATE_KEY_PASSPHRASE = "YOUR_KEY_PASSPHRASE"; // If your key is encrypted (or remove this line if not)
// const KEY_ID = "";                                    // Optional: your key's fingerprint (see docs)

// === READ PRIVATE KEY ===
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

// === JWT Claims ===
const payload = {
  iss: `https://${SNOWFLAKE_ACCOUNT}.snowflakecomputing.com/api/v2/statements`, // issuer is account + .snowflakecomputing.com
  sub: SNOWFLAKE_USER,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 5,        // Valid for 5 minutes
  // Optional: 'kid': KEY_ID,
};

const signOptions = {
  algorithm: "RS256",
  // ...(KEY_ID ? { keyid: KEY_ID } : {}),
  // ...(PRIVATE_KEY_PASSPHRASE ? { passphrase: PRIVATE_KEY_PASSPHRASE } : {}),
};

const token = jwt.sign(payload, { key: privateKey}, signOptions);

console.log("JWT for Snowflake:", token);





