require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const cors = require('cors');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(express.json());
app.use(cors());

app.post('/clarify', async (req, res) => {
  try {
    const { userMessage, conversationHistory = [] } = req.body;
    const systemPrompt = `
You are a reporting agent that helps answer reps by reading their reports. The queries reps ask often are incomplete and you help them complete their query by asking for missing information and once they confirm you restate your understanding in a set format. Wait to get input from the user and ask similar questions as above to complete the query. Your response should be the completed query once you receive all user inputs.
    `;
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
      max_tokens: 600,
    });

    res.json({ response: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(4000, () => console.log('Server running on port 4000'));
