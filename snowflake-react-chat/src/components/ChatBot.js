import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';

const ChatBot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatRef = useRef();

  useEffect(() => {
    document.body.classList.add("show-chatbot");
    const greeting = `Hello 👋! How may I assist you?`;
    setMessages([{ role: 'assistant', text: greeting }]);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    }, 100);
  };

  const sendToSnowflakeAPI = async (message) => {
    const SNOWFLAKE_URL = process.env.REACT_APP_SNOWFLAKE_URL;
    const ROLE = process.env.REACT_APP_SNOWFLAKE_ROLE;
    const WAREHOUSE = process.env.REACT_APP_SNOWFLAKE_WH;
    const DATABASE = process.env.REACT_APP_SNOWFLAKE_DB;
    const SCHEMA = process.env.REACT_APP_SNOWFLAKE_SCHEMA;

    console.log('JWT:', process.env.REACT_APP_JWT); // Add this line

    try {
      const res = await fetch(`${SNOWFLAKE_URL}/api/v2/statements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.REACT_APP_JWT}`,
        },
        body: JSON.stringify({
          // statement: `CALL AGENT_GATEWAY('${message}');`,
          statement: `SELECT TOP 2* FROM CLAIMS;`,
          role: ROLE,
          warehouse: WAREHOUSE,
          database: DATABASE,
          schema: SCHEMA
        })
      });

      const text = await res.text();
      const lines = text.split('\n');
      for (let line of lines) {
        if (line.includes('"data" : [ [')) {
          const match = line.match(/\[\[(.+?)\]\]/);
          if (match) {
            const json = JSON.parse(match[1].replace(/'/g, '"'));
            return json.output || "I couldn’t process your request.";
          }
        }
      }
      return "Sorry, I couldn't process your request.";
    } catch (err) {
      console.error('API error:', err);
      return 'Unexpected error connecting to Snowflake API.';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', text: input }];
    setMessages(newMessages);
    setInput('');
    scrollToBottom();

    const pendingResponse = { role: 'assistant', text: 'Analyzing...' };
    setMessages([...newMessages, pendingResponse]);

    const response = await sendToSnowflakeAPI(input);
    setMessages([...newMessages, { role: 'assistant', text: response }]);
    scrollToBottom();
  };

  return (
    <div className="chatbot">
      <header>
        <h3>ORION <strong style={{ color: '#94d6f2' }}>Field Assistant</strong></h3>
      </header>
      <ul className="chatbox" ref={chatRef}>
        {messages.map((msg, idx) => (
          <li key={idx} className={`chat ${msg.role === 'user' ? 'outgoing' : 'incoming'}`}>
            <p>{msg.text}</p>
          </li>
        ))}
      </ul>
      <div className="chat-input">
        <textarea
          placeholder="Enter a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        ></textarea>
        <span className="material-symbols-rounded" onClick={handleSend}>send</span>
      </div>
    </div>
  );
};

export default ChatBot;
