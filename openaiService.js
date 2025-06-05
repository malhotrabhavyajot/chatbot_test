const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getClarifiedQuery(userMessage, conversationHistory=[]) {
    // Compose the chat history, including your system prompt
    const systemPrompt = `
You are a reporting agent... [insert your whole system prompt as in your question, minus the examples]
    `;
    // Prepare message format as required by OpenAI API
    const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
        model: "gpt-4o", // or "gpt-4-turbo", "gpt-3.5-turbo"
        messages,
        temperature: 0.3,
        max_tokens: 600,
    });

    return completion.choices[0].message.content;
}

module.exports = { getClarifiedQuery };
