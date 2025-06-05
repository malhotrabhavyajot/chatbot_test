// ======= server.js =======

require('dotenv').config(); // Load .env (must be FIRST!)
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// ====== SNOWFLAKE CONFIGURATION ======
const SNOWFLAKE_ACCOUNT = "WUQZVQT-DKC22677";
const SNOWFLAKE_USER = "MALHOTRABHAVYAJOT";
const SNOWFLAKE_URL = 'https://WUQZVQT-DKC22677.snowflakecomputing.com/api/v2/statements';
const SNOWFLAKE_ROLE = 'ACCOUNTADMIN';
const SNOWFLAKE_WAREHOUSE = 'INSURANCEWAREHOUSE';
const SNOWFLAKE_DATABASE = 'CHATBOT_DEMO';
const SNOWFLAKE_SCHEMA = 'CHATBOT_METADATA';
const PRIVATE_KEY_PATH = 'rsa_key.p8';
const PRIVATE_KEY_PASSPHRASE = 'CeDzue48qiqbzIu';

// ====== OPENAI CONFIGURATION ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ====== SNOWFLAKE JWT GENERATOR ======
function generateSnowflakeJWT() {
  const privateKeyFile = fs.readFileSync(PRIVATE_KEY_PATH);
  const privateKeyObject = crypto.createPrivateKey({
    key: privateKeyFile,
    format: 'pem',
    passphrase: PRIVATE_KEY_PASSPHRASE
  });
  const privateKey = privateKeyObject.export({ format: 'pem', type: 'pkcs8' });

  const publicKeyObject = crypto.createPublicKey({ key: privateKey, format: 'pem' });
  const publicKey = publicKeyObject.export({ format: 'der', type: 'spki' });
  const publicKeyFingerprint = 'SHA256:' + crypto.createHash('sha256').update(publicKey).digest('base64');

  const qualified_username = `${SNOWFLAKE_ACCOUNT}.${SNOWFLAKE_USER}`;
  const signOptions = {
    iss: qualified_username + '.' + publicKeyFingerprint,
    sub: qualified_username,
    exp: Math.floor(Date.now() / 1000) + (60 * 5),
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(signOptions, privateKey, { algorithm: 'RS256' });
  return token;
}

// ====== SNOWFLAKE ASYNC POLL HELPER ======
async function pollStatementResult(statementHandle, token) {
  let pollCount = 0;
  let result = null;
  while (pollCount < 20) {
    await new Promise(resolve => setTimeout(resolve, 800));
    const getRes = await fetch(`${SNOWFLAKE_URL}/${statementHandle}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    result = await getRes.json();
    console.log(`Proxy: Polled result [poll ${pollCount + 1}]:`, JSON.stringify(result, null, 2));
    if (result.status === 'Success' || result.status === 'FAILED_WITH_ERROR') {
      break;
    }
    pollCount++;
  }
  return result;
}

// ====== SNOWFLAKE PROXY ROUTE ======
app.post('/api/snowflake', async (req, res) => {
  const { statement } = req.body;
  const token = generateSnowflakeJWT();

  try {
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

// ====== OPENAI CLARIFY ROUTE (Conversational/Quick-Reply) ======
// Simple in-memory store for conversation history (keyed by session/user)
const conversationHistories = {}; // e.g., { sessionId1: [ ... ], sessionId2: [ ... ] }


const sessionId = "default"; // Static ID for single-user scenario
 
app.post('/api/clarify', async (req, res) => {
  try {
    const { userMessage } = req.body;

    // // Fail early if sessionId not provided
    // if (!sessionId) {
    //   return res.status(400).json({ error: "Missing sessionId in request body" });
    // }


    const systemPrompt = `
You are a reporting agent that helps answer reps by reading their reports. 
The queries reps ask often are incomplete and you help them complete their query by asking for missing information and once they confirm you restate your understanding in a set format. 
I am listing some examples below, could you help me with other queries based on the same lines? 

============ 
Example 1 Question from Rep - show me the sales for Atlanta? 

Expected response - Sure, I can help you with this. But I need some additional information - 
1. Sales based on which metric? (NRx, TRx) 
2. Which geography? (Region, Ecosystem, Territory) 
3. What time period? (CW, R17W or R4W) 
4. Would you like to filter on any brand? (Exelon, Nuvexa, Axanol, Eliprax, Velomir) 
5. Any other filters or columns you'd like to include? (Age group, Retail Channel) 

User Response - TRx, Ecosystem, CW. Add brand name as a column. 

Your response - "Show me the TRx for Atlanta Ecosystem for CW time period by Brand Name" 

============ 

**I don't need any more examples. Wait to get input from the user and ask similar questions as above to complete the query. Your response should be the completed query once you receive all user inputs** 

** Don't include any suggestions or unnecessary information. Your response should be to the point and just the revised query*** 

** In your response, ensure to include the column names. E.g.: Elexon Brand, CW Time Period, etc.***

Respond ONLY in the following JSON format:
{
  "assistant_message": "response"
}
`;

    // Initialize history if not present
    if (!conversationHistories[sessionId]) {
      conversationHistories[sessionId] = [
        { role: "system", content: systemPrompt }
      ];
    }

    // Push the latest user message to the session history
    conversationHistories[sessionId].push({ role: "user", content: userMessage });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: conversationHistories[sessionId],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" }
    });

    let parsed;
    try {
      parsed = JSON.parse(completion.choices[0].message.content);

      // Push the assistant's reply to the conversation history
      conversationHistories[sessionId].push({
        role: "assistant",
        content: parsed.assistant_message
      });

      // Optional: Trim history to keep memory low (e.g., last 10 turns)
      if (conversationHistories[sessionId].length > 20) {
        conversationHistories[sessionId] = conversationHistories[sessionId].slice(-20);
      }

      return res.json(parsed);

    } catch (e) {
      return res.json({
        assistant_message: "Could you clarify your request? Something seems unclear."
      });
    }

  } catch (err) {
    console.error("Error in /api/clarify:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
 

// ====== START THE SERVER ======
app.get('/test', (req, res) => res.send("SERVER FILE IS RUNNING!"));

app.listen(4000, () => console.log('Proxy running on http://localhost:4000'));
