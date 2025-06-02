const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Allow React frontend to access backend
app.use(cors());
app.use(express.json());

// --- SNOWFLAKE PROXY EXAMPLE ---
// You likely already have this route for /api/snowflake; adapt as needed!
app.post('/api/snowflake', async (req, res) => {
  // This should proxy to your Snowflake REST endpoint with necessary headers/auth
  // Example implementation (replace with your working Snowflake proxy code):
  const SNOWFLAKE_API_URL = process.env.SNOWFLAKE_API_URL; // e.g., https://account.region.snowflakecomputing.com/api/v2/statements
  const token = process.env.SNOWFLAKE_TOKEN; // Bearer token or use session auth as needed

  try {
    const snowRes = await fetch(SNOWFLAKE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });
    const data = await snowRes.text(); // (may be .json() if you want)
    res.send(data);
  } catch (err) {
    res.status(500).json({ error: "Snowflake connection error" });
  }
});

// --- OPENAI LLM ENDPOINT ---
app.post('/api/llm', async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ answer: "OpenAI key missing" });
  try {
    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // or "gpt-4"
        messages: [{ role: "user", content: prompt }],
        max_tokens: 180
      })
    });
    const data = await gptRes.json();
    const answer = data.choices?.[0]?.message?.content || "Sorry, I don't know that one!";
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ answer: "Sorry, something went wrong with my brain. Try again later!" });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
