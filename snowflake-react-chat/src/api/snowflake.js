// src/api/snowflake.js

const SNOWFLAKE_URL = "https://otsuka_ctdev.us-east-1.snowflakecomputing.com";


// Optionally: fallback token provider if the main one fails/refreshes
async function fetchTokenFromRender() {
  try {
    const res = await fetch("https://project-f3vi.onrender.com/generate_jwt");
    const data = await res.json();
    return data.token;
  } catch (error) {
    console.error("Failed to fetch token from Render:", error);
    return null;
  }
}

async function callSnowflake(statement, token) {
  const response = await fetch(`${SNOWFLAKE_URL}/api/v2/statements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      statement: `CALL CUSTOM_AGENT('${statement}')`,
      role: "MSTR_READER_ROLE",
      warehouse: "MSTR_M_WH",
      database: "CDR",
      schema: "CDR_RPT"
    }),
  });
  return response;
}

// Main function: handles token fallback and parses results
export async function sendToSnowflakeAPI(message, initialToken) {
  let token = initialToken;
  let response = await callSnowflake(message, token);

  // Fallback if token expired/unauthorized
  if (response.status === 401 || response.status === 403) {
    token = await fetchTokenFromRender();
    if (!token) return "Error: Unable to refresh token.";
    response = await callSnowflake(message, token);
  }

  const rawText = await response.text();
  let extractedTexts = [];

  const lines = rawText.split("\n");
  for (const line of lines) {
    if (line.startsWith('  "data" : [ [')) {
      try {
        const rawLine = line.replace('  "data" : ', "").replace('[ [', '[[').replaceAll("'", "").replace('] ],', ']]');
        const dataArray = JSON.parse(rawLine);
        const innerString = dataArray[0][0];
        const fixedJsonString = innerString
          .replace(/'/g, '"')
          .replace(/None/g, 'null')
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false');
        const parsedObject = JSON.parse(fixedJsonString);
        extractedTexts.push(parsedObject.output);
      } catch (error) {

      }
    }
  }

  if (extractedTexts.length > 0) return extractedTexts.join(" ");

  return "No results.";
}
