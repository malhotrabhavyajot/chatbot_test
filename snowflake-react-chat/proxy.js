const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// ====== CONFIGURATION ======
const SNOWFLAKE_ACCOUNT = "WUQZVQT-DKC22677";
const SNOWFLAKE_USER = "MALHOTRABHAVYAJOT"; // ALL CAPS username
const SNOWFLAKE_URL = 'https://WUQZVQT-DKC22677.snowflakecomputing.com/api/v2/statements';
const SNOWFLAKE_ROLE = 'ACCOUNTADMIN';
const SNOWFLAKE_WAREHOUSE = 'INSURANCEWAREHOUSE';
const SNOWFLAKE_DATABASE = 'CHATBOT_DEMO';
const SNOWFLAKE_SCHEMA = 'CHATBOT_METADATA';
const PRIVATE_KEY_PATH = 'rsa_key.p8'; // path to your ENCRYPTED private key
const PRIVATE_KEY_PASSPHRASE = 'CeDzue48qiqbzIu'; // your passphrase

// ========== END CONFIGURATION ==========

const app = express();
app.use(cors());
app.use(express.json());

// Function to dynamically generate JWT with fingerprint for each call
function generateSnowflakeJWT() {
  const privateKeyFile = fs.readFileSync(PRIVATE_KEY_PATH);

  // Create private key object (with passphrase)
  const privateKeyObject = crypto.createPrivateKey({
    key: privateKeyFile,
    format: 'pem',
    passphrase: PRIVATE_KEY_PASSPHRASE
  });
  const privateKey = privateKeyObject.export({ format: 'pem', type: 'pkcs8' });

  // Get fingerprint (Snowflake expects this for the JWT "iss" claim)
  const publicKeyObject = crypto.createPublicKey({ key: privateKey, format: 'pem' });
  const publicKey = publicKeyObject.export({ format: 'der', type: 'spki' });
  const publicKeyFingerprint = 'SHA256:' + crypto.createHash('sha256').update(publicKey).digest('base64');

  const qualified_username = `${SNOWFLAKE_ACCOUNT}.${SNOWFLAKE_USER}`;

  const signOptions = {
    iss: qualified_username + '.' + publicKeyFingerprint, // very important!
    sub: qualified_username,
    exp: Math.floor(Date.now() / 1000) + (60 * 5), // 5 minutes expiry is best
    iat: Math.floor(Date.now() / 1000),
  };

  // Sign the JWT
  const token = jwt.sign(signOptions, privateKey, { algorithm: 'RS256' });
  return token;
}

// Polling helper for async queries
async function pollStatementResult(statementHandle, token) {
  let pollCount = 0;
  let result = null;
  while (pollCount < 20) {
    await new Promise(resolve => setTimeout(resolve, 800)); // wait 800ms
    const getRes = await fetch(`${SNOWFLAKE_URL}/${statementHandle}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    result = await getRes.json();
    console.log(`Proxy: Polled result [poll ${pollCount+1}]:`, JSON.stringify(result, null, 2));
    if (
      result.status === 'Success' ||
      result.status === 'FAILED_WITH_ERROR'
    ) {
      break;
    }
    pollCount++;
  }
  return result;
}

app.post('/api/snowflake', async (req, res) => {
  const { statement } = req.body;
  const token = generateSnowflakeJWT();

  try {
    // 1. Send the statement
    const sfRes = await fetch(SNOWFLAKE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        statement,
        role: SNOWFLAKE_ROLE,
        warehouse: SNOWFLAKE_WAREHOUSE,
        database: SNOWFLAKE_DATABASE,
        schema: SNOWFLAKE_SCHEMA
      })
    });
    const initial = await sfRes.json();
    console.log("Proxy: Initial Snowflake response:", JSON.stringify(initial, null, 2));

    // 2. If async, poll for results
    if (
      initial.status === 'pending' ||
      (initial.message && initial.message.toLowerCase().includes('asynchronous'))
    ) {
      if (!initial.statementHandle) {
        console.error("Proxy: No statementHandle for async query!");
        return res.status(500).json({ error: "Snowflake returned async status but no statementHandle" });
      }
      const result = await pollStatementResult(initial.statementHandle, token);
      return res.status(200).json(result);
    } else {
      return res.status(200).json(initial);
    }
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send(err.toString());
  }
});

app.listen(4000, () => console.log('Proxy running on http://localhost:4000'));
