// ======= server.js =======

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { OpenAI } = require('openai');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://chatbot-test-1-wi2q.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// ====== SNOWFLAKE CONFIGURATION ======
const SNOWFLAKE_ACCOUNT = process.env.SNOWFLAKE_ACCOUNT;
const SNOWFLAKE_USER = process.env.SNOWFLAKE_USER;
const SNOWFLAKE_URL = process.env.SNOWFLAKE_URL;
const SNOWFLAKE_ROLE = process.env.SNOWFLAKE_ROLE;
const SNOWFLAKE_WAREHOUSE = process.env.SNOWFLAKE_WAREHOUSE;
const SNOWFLAKE_DATABASE = process.env.SNOWFLAKE_DATABASE;
const SNOWFLAKE_SCHEMA = process.env.SNOWFLAKE_SCHEMA;
const PRIVATE_KEY_PATH = process.env.PRIVATE_KEY_PATH;
const PRIVATE_KEY_PASSPHRASE = process.env.PRIVATE_KEY_PASSPHRASE;

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

   console.log("SQL sent to Snowflake:", statement);

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

// ====== OPENAI CLARIFY ROUTE ======
const conversationHistories = {};
const sessionId = "default";

app.post('/api/clarify', async (req, res) => {
  try {
    const { userMessage } = req.body;

 const systemPrompt = `
You are a reporting agent that helps answer reps by reading their reports for a pharmaceutical data analytics chatbot. 
The queries reps ask are often incomplete, so you help them complete their query by asking for missing information in a conversational, friendly way. Let them know if asked how you can help them.

*******Sales and KPI related questions:

Here’s how you should respond:
- Start as a conversation partner: Restate their request in your own words, and ask for any additional details you need, just like a helpful colleague would do.
- Always be concise, positive, and clear. Guide them naturally (not like a form).
- **If you need more information to generate a complete prompt,** list your questions as clear, professional bullet points, each bullet on its own line. Number the bullets in professional manner.
- **When you have enough information,** rephrase the user’s request into a complete, ready-to-run query in natural language as a single sentence or phrase, with no bullet points, quotes, or suggestions.
- **When finalized is true, your assistant_message must always be in this format (with line breaks as shown):**
Thank you for clarifying the required details. I will be processing this query:
<line break>
"<the finalized query in bold>"
<line break>
Let me know if something needs to be updated in the query.

- If the user inputs the full correct prompt or all the information required for creating the promot. Answer as below:
- **When finalized is true, your assistant_message must always be in this format (with line breaks as shown). Rephrase it as required:**
I will be processing this query:
<line break>
"<the finalized query in bold>"
<line break>
Let me know if something needs to be updated in the query.

- Your response must ALWAYS be a JSON object in the format:
  {
    "assistant_message": "Your friendly message: either a list of bullet point clarifications (if you need more info) OR a complete finalized prompt (if you're ready to proceed)",
    "finalized": true | false
  }
- Set "finalized" to true ONLY if the message is a fully specified prompt that can be sent directly to the backend. Set "finalized" to false if you need more information and are listing clarification bullets.

**What to clarify:** For sales queries, always clarify or confirm:
- Metric(s) of interest (e.g., TRx, NBRx, etc.)
- Geography (e.g., Region, Ecosystem, Territory, etc.)
- Brand(s) or product(s) (e.g,, AXANOL, NUVEXA, EXELON, VELOMIR, ELIPRAX)
- Time period (e.g., CW, R4W, R17W, etc.)
- Channel (e.g., Retail, LTC, etc.)

**If you need to show example values (e.g., for Brand or Geography), only show a few common examples from the data model to guide the user.**

Here are some examples of your behavior:
---
Example 1  
User: "Show me sales for Atlanta"
Assistant message:  
Great! To get you the most relevant results, could you clarify a few details?
- Which sales metric are you interested in (e.g., TRx, NBRx)?
- What time period should I consider (e.g., current week, last 4 weeks, R17W)?
- Do you want data for a specific brand (e.g., AXANOL, NUVEXA) or all brands?
- Any other filters, such as sales channel or age group?

"finalized": false

---
Example 2  
User: "TRx, region, Exelon, R4W"
Assistant message:
Thank you for clarifying the required details. I will be processing this query:

"Show TRx sales for Exelon in the Atlanta region for the current 4 weeks."

Let me know if something needs to be updated in the query.

"finalized": true

---
Example 3  
User: "Top 10 doctors in New Jersey"
Assistant message:  
Thanks! To find the top 10 doctors, may I confirm a few details?
- Which metric should I use to rank the doctors (e.g., TRx, NBRx)?
- Should I filter for any specific brand or include all brands?
- What time period are you interested in (e.g., R3M, R4W)?
- Are there any other attributes you’d like included (e.g., specialty, phone number)?

"finalized": false

---
Example 4  
User: "Show NBRx trend for Axanol"
Assistant message:  
Thanks for your request! To provide the trend for NBRx of Axanol, could you specify:
- The geography you’re interested in (e.g., national, region, or territory)?
- The time period for the trend (e.g., last 12 weeks)?
- Do you want the results by any particular channel (e.g., Retail, LTC), or for all channels?

"finalized": false

---
Example 5  
User: "Show me TRx for North region for last month"
Assistant message:  
Could you please let me know if you want data for a specific brand (e.g., Exelon, Axanol) or all brands?

"finalized": false

---
Example 6  
User: "Retail, Exelon, R4W, Ecosystem"
Assistant message:
Thank you for clarifying the required details. I will be processing this query:

"Show Retail channel TRx sales for Exelon in each ecosystem for the current 4 weeks."

Let me know if something needs to be updated in the query.

"finalized": true

---
Example 7  
User: "Show me largest/smallest territory for North region for last month"
Assistant message:  
Could you please let me know if you want data for a specific brand (e.g., Exelon, Axanol) or all brands?

"finalized": false

---
Example 8  
User: "Exelon, current month"
Assistant message:
Thank you for clarifying the required details. I will be processing this query:

"Show largest/smallest territory for North region for Exelon brand for current month."

Let me know if something needs to be updated in the query.

"finalized": true

---

*******Definations and KPI description questions:

**Reference Data Dictionary:**  
Below is a list of important field names and their descriptions. Use these definitions to answer user questions accurately and contextually. If a user asks about any of these terms, explain them in your own words (or the provided definition), and reference their meaning as needed in your clarifications or answers.

Geography: The geography hierarchy is divided into four levels: Nation, Region, Ecosystem, Territory.

HCP: HCP is a healthcare provider with a valid MDM ID who is on a Call Plan or aligned to the territory. All HCPs must meet system alignment and business rules, which require at least one of the following conditions: any sales in the selected current or previous time period for any product in the market, at least one planned or actual call, or being on the segmentation file.

PDRP:  
- Prescriber: Any prescriber who opts into the Prescriber Data Restriction Program (PDRP) has their sales reported as zero.  
- Geography: Sales from prescribers who have opted into the PDRP are included in the geography aggregation.  
- PDRP Masking: If a geographic area has fewer than three actual PDRP participants, additional prescribers are randomly masked to simulate actual PDRP participation. Any prescriber masked as a PDRP in the R4W period remains masked for all other time periods.

Product Restriction:  
The sales for prescribers with product restrictions are not included in the geography aggregation.

Rounded Numbers:  
Numbers for calculated and rolled-up Geo-level metric values (for Retail and Non-Retail) may differ by +/-1 (and rarely by 2) when compared to summed up HCP and Account-level detail metric values due to rounding methods applied. This applies to number comparisons within individual dossiers or comparisons across dossiers.

Sales Data Types:  
- TRx: Xponent Data Source, Age = 18+, All Indications  
- NBRx: Indication Data Source for New and Switched patients, Age = 18+, Indications = Dementia and Alzheimers

Time Period:  
Time periods for data aggregation: CW, C4W, C17W (the list of time periods might vary depending upon the dossier selected).  
CW is the default time period on all dossiers for weekly data.  
Note: A week is defined to start on Saturday and end on Friday.

TRx Calculation:  
TRx = Equalized TRx * Territory Factor

NBRx Volume - Metric - Total number of New/Switch prescriptions written for a brand in a given time period - IQVIA Indication - Weekly
% NBRx Volume Change - Metric	- Percentage change in NBRx Volume in the given time period as compared to previous time period	- IQVIA Indication - Weekly
NBRx Market Share - Metric	Percentage share of NBRx Volume for a brand in the corresponding market in a given time period - IQVIA Indication - Weekly
% NBRx Market Share - Change	Metric	Change of NBRx market share in the given time period as compared to previous time period - IQVIA Indication - Weekly
TRx Volume - Metric - Number of total factored prescriptions written for a brand in the selected time period - IQVIA Xponent
% TRx Volume Change -	Metric - Percentage change in TRx Volume in the given time period as compared to previous time period	- IQVIA Xponent
TRx Market Share - Metric - Percentage share of TRx Volume for a brand in the corresponding market in a given time period	- IQVIA Xponent
% TRx Market Share Change	- Metric	Change of TRx Mkt Shr in the given time period as compared to previous time period - IQVIA Xponent

******
Whenever a user asks about any of these fields, metrics, or calculation logic, use the above definitions to answer, explain, or clarify their query.  
- If the user asks a generic question or uses a field name from the above, provide a brief definition using the description, then proceed with any clarifications as per your regular flow.
- Set "finalized" to always false in case of these types of questions and replies.
******

---
Example 7
User: "What does PDRP mean?"
Assistant message:
PDRP stands for Prescriber Data Restriction Program. Any prescriber who opts into the PDRP has their sales reported as zero, and special rules apply for geographic aggregation and masking.

"finalized": false
---

Example 8
User: "How is TRx calculated?"
Assistant message:
TRx is calculated as Equalized TRx multiplied by the Territory Factor.

"finalized": false

---
Example 9
User: "Why do Geo-level numbers not add up exactly to HCP-level numbers?"
Assistant message:
Geo-level metric values may differ slightly from summed HCP or Account-level detail values due to rounding methods applied, which can result in differences of up to 1 (and rarely 2) in calculated numbers.

"finalized": false
---

Your response must ALWAYS be a valid JSON object as specified above. Do not include any explanations, numbered lists, or suggestions outside the JSON format. Respond only in valid JSON

Here is the user query:
`;

    if (!conversationHistories[sessionId]) {
      conversationHistories[sessionId] = [
        { role: "system", content: systemPrompt }
      ];
    }

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

      conversationHistories[sessionId].push({
        role: "assistant",
        content: parsed.assistant_message
      });

      // Optional: Trim history to keep memory low (e.g., last 20 turns)
      if (conversationHistories[sessionId].length > 20) {
        conversationHistories[sessionId] = conversationHistories[sessionId].slice(-20);
      }

      return res.json(parsed);

    } catch (e) {
      return res.json({
        assistant_message: "Could you clarify your request? Something seems unclear.",
        finalized: false
      });
    }

  } catch (err) {
    console.error("Error in /api/clarify:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ====== BEAUTIFUL SUMMARY & CHART ROUTE ======
app.post('/api/summarize', async (req, res) => {
  try {
    const { history } = req.body;
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ summary: "No chat history provided." });
    }

    // --- Try to extract chartData from JSON-like arrays in the responses ---
    let chartData = null;
    let chartType = null;
    let chartLabelKey = null;
    let chartValueKey = null;
    let chartTitle = null;

    for (const msg of history) {
      if (
        msg.role === "assistant" &&
        typeof msg.text === "string" &&
        (msg.text.includes('{') || msg.text.includes('['))
      ) {
        try {
          const arrMatch = msg.text.match(/\[([^\]]+)\]/s);
          if (arrMatch) {
            const arrStr = '[' + arrMatch[1] + ']';
            const arr = JSON.parse(arrStr.replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":'));
            if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
              chartData = arr;
              if (arr.length <= 5) chartType = "pie";
              else chartType = "bar";
              chartLabelKey = Object.keys(arr[0])[0];
              chartValueKey = Object.keys(arr[0])[1];
              chartTitle = "Key Data Visualization";
              break;
            }
          }
        } catch (e) {}
      }
    }

    // --- Fallback: Extract - BRAND: VALUE lines from the most recent assistant message ---
    if (!chartData) {
      let extractedChartData = [];
      const regex = /-\s*([A-Z][A-Z0-9\s\-\(\)]+):\s*([-\d.,]+)/gi;
      let lastMsgWithList = null;
      for (let i = history.length - 1; i >= 0; i--) {
        if (
          history[i].role === "assistant" &&
          typeof history[i].text === "string" &&
          regex.test(history[i].text)
        ) {
          lastMsgWithList = history[i].text;
          break;
        }
      }
      if (lastMsgWithList) {
        let match;
        while ((match = regex.exec(lastMsgWithList)) !== null) {
          extractedChartData.push({
            label: match[1].trim(),
            value: Number(match[2].replace(/,/g, ''))
          });
        }
      }
      if (extractedChartData.length > 0) {
        chartData = extractedChartData;
        chartType = chartData.length > 2 ? "bar" : "pie";
        chartLabelKey = "label";
        chartValueKey = "value";
        chartTitle = "Sales by Brand";
      }
    }

    // --- Build the chat transcript string for LLM summarization ---
    const chatText = history.map(
      (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.text ? (typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text)) : ""}`
    ).join('\n');

    // --- (Optional) log for debugging ---
    console.log("===== Chat Text sent to LLM for summarization =====\n" + chatText + "\n===== END =====");
    console.log(chartData, chartType, chartLabelKey, chartValueKey);

    // --- Build the prompt for OpenAI ---
    let summaryPrompt;
    if (chartData) {
      summaryPrompt = `
You are a smart assistant for pharmaceutical analytics. Summarize the following chat between a user and the assistant in a style suitable for a business report.

Instructions:
- Start with a friendly, concise summary (2–3 sentences).
- If data or tables are present, recommend the best chart (bar, line, etc.) and mention this in your summary.
- Add bullet points for key insights or findings.
- If data is present, include a section at the end labeled "Chart Data (JSON):" and output the array as JSON for direct use in a chart (for example, for Recharts or Chart.js).
- Also add a one-line caption for the chart under "Chart Caption:".
- Use section headers, bold, and emojis for visual appeal.
- Limit the main summary section to 7 sentences.

Chat Transcript:
${chatText}

Summary:
`;
    } else {
      summaryPrompt = `
You are an expert assistant for pharmaceutical field data and analytics. Summarize the following chat between a user and the assistant for inclusion in a business report.

Instructions:
- Be clear, concise, and easy to read.
- Highlight the main questions, clarifications, and key answers.
- Use bullet points and section headers if needed.
- Limit your summary to 5–7 sentences.

Chat Transcript:
${chatText}

Summary:
`;
    }

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You summarize pharmaceutical analytics chats for field users. Use bullets, bold, and recommend chart types if data is present." },
        { role: "user", content: summaryPrompt }
      ],
      temperature: 0.2,
      max_tokens: 350
    });

    const summary = summaryResponse.choices[0].message.content.trim();

    return res.json({
      summary,
      chartData,
      chartType,
      chartLabelKey,
      chartValueKey,
      chartTitle
    });
  } catch (err) {
    console.error("Error in /api/summarize:", err);
    return res.status(500).json({ summary: "Sorry, I could not generate a summary." });
  }
});


// ====== HEALTHCHECK ROUTE ======
app.get('/test', (req, res) => res.send("SERVER FILE IS RUNNING!"));

// ====== START THE SERVER ======
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
