import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ZSIcon from '../assets/ZS_Associates.png';

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const suggestions = ["What is Field Assistant?", "Show top 5 territories", "Show top 10 HCPs", "Show top 10 Accounts"];
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const chatRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (isOpen) {
      const greeting = `Hello 👋! How may I assist you?`;
      setMessages([{ role: 'assistant', text: greeting }]);
    }
  }, [isOpen]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendToSnowflakeAPI = async (message) => {
    try {
      const res = await fetch('http://localhost:4000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: message })
      });

      if (!res.ok) throw new Error('Request failed');

      const data = await res.json();
      const rows = data.rows || [];
      if (rows.length === 0) return '🔍 No results found.';

      const formatted = rows.map((row, i) => `🔹 ${JSON.stringify(row, null, 2)}`).join('\n\n');
      return formatted;
    } catch (err) {
      console.error('API error:', err);
      return '⚠️ Unable to connect to the backend.';
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();

    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    localStorage.setItem('chatMessages', JSON.stringify(newMessages));
    setInput('');

    const pendingResponse = { role: 'assistant', text: '⏳ Working on your request...' };
    const pendingList = [...newMessages, pendingResponse];
    setMessages(pendingList);
    localStorage.setItem('chatMessages', JSON.stringify(pendingList));

    const response = await sendToSnowflakeAPI(userMessage);
    const updatedMessages = [...newMessages, { role: 'assistant', text: response }];
    setMessages(updatedMessages);
    localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  return (
    <>
      <div style={{ background: 'linear-gradient(to bottom right, #f7faff, #e2ecf4)', minHeight: '100vh' }}>
            <button
            className="chatbot-toggler modern-toggler"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle chatbot"
            style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 10000 }}>
              {isOpen ? '✖' : <img src={ChatbotIcon} alt="Chatbot" style={{ width: 48, height: 48}} />}
            </button>

        {isOpen && (
          <div
            className={`chatbot modern-chatbot ${darkMode ? 'dark-mode' : ''}`}
            style={{ position: 'fixed', right: '20px', bottom: '80px', width: isExpanded ? '95vw' : '90vw', height: isExpanded ? '80vh' : '70vh', maxWidth: isExpanded ? '600px' : '400px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: darkMode ? '#1e1e1e' : '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.3s ease', zIndex: 9999 }}>

            <header style={{ backgroundColor: darkMode ? '#222' : '#fff', color: darkMode ? '#fff' : '#000', padding: '14px 16px', fontSize: '22px', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
              <span style={{ fontWeight: 600 }}>ORION <span style={{ color: '#6b38fb' }}>Field Assistant</span></span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={toggleTheme} title="Toggle theme" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="20" height="20" fill="#6b38fb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                  </svg>
                </button>
                <button onClick={() => { setMessages([]); localStorage.removeItem('chatMessages'); }} title="Refresh chat" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="20" height="20" fill="#6b38fb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 4V1L8 5l4 4V6c3.3 0 6 2.7 6 6s-2.7 6-6 6a6.007 6.007 0 0 1-5.66-4H4.06C4.54 17.1 7.96 20 12 20c4.4 0 8-3.6 8-8s-3.6-8-8-8z" />
                  </svg>
                </button>
                <button onClick={() => setIsExpanded(prev => !prev)} title="Toggle size" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <svg width="20" height="20" fill="#6b38fb" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M4 4h7v2H6v5H4V4zm16 0v7h-2V6h-5V4h7zM4 20v-7h2v5h5v2H4zm16-7v7h-7v-2h5v-5h2z" />
                  </svg>
                </button>
              </div>
            </header>

            <ul className="chatbox" ref={chatRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', scrollBehavior: 'smooth' }}>
              {messages.map((msg, idx) => (
                <li 
                key={idx}
                className={`chat ${msg.role === 'user' ? 'outgoing' : 'incoming'}`}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px',
                  animation: 'fadeIn 0.2s ease-in'
                  }}
                  >
                  <p className="chat-bubble">
                    {msg.text}
                  </p>
                </li>
              ))}
            </ul>

            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const newMessages = [...messages, { role: 'user', text: s }];
                    setMessages(newMessages);
                    const pendingResponse = { role: 'assistant', text: '⏳ Working on your request...' };
                    setMessages([...newMessages, pendingResponse]);
                    const response = await sendToSnowflakeAPI(s);
                    setMessages([...newMessages, { role: 'assistant', text: response }]);
                  }}
                  className="suggestion-button"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="chat-input">
              <textarea
                ref={inputRef}
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                rows={1}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
              ></textarea>
              <button onClick={handleSend} title="Send message" className="send-button">
                Send
              </button>
            </div>

            <footer className="chatbot-footer">
              Powered by <img src={ZSIcon} alt="ZS Associates"/>
            </footer>

          </div>
        )}
      </div>
    </>
  );
};

export default ChatBot;
