require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function callOpenAI() {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // or "gpt-3.5-turbo", "gpt-4-turbo"
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Say hello in a fun way!" }
    ]
  });

  console.log("OpenAI Response:", completion.choices[0].message.content);
}

callOpenAI();
