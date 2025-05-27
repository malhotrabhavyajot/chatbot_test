import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ZSIcon from '../assets/ZS_Associates.png';

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const [feedback, setFeedback] = useState({});
  const suggestions = [
    "What is Field Assistant?",
    "Show top 5 territories",
    "Show top 10 HCPs",
    "Show top 10 Accounts"
  ];
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const chatRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (isOpen) {
      const greeting = `Hello 👋! How may I assist you?`;
      setMessages([{ role: 'assistant', text: greeting }]);
      setFeedback({});
      localStorage.removeItem('chatMessages');
    }
  }, [isOpen]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendToSnowflakeAPI = async (message) => {
    try {
      const res = await fetch('http://localhost:4000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    setToast('Thanks for your feedback!');
    setTimeout(() => setToast(''), 1100);
    // Optionally send to analytics
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  return (
    <>
      <div className={`chatbot-bg${darkMode ? ' dark-mode' : ''}`}>
        <button
          className="chatbot-toggler modern-toggler"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle chatbot"
        >
          {isOpen ? <span className="icon-close" /> : <img src={ChatbotIcon} alt="Chatbot" style={{ width: 48, height: 48 }} />}
        </button>
        {isOpen && (
          <div
            className={`chatbot modern-chatbot${darkMode ? ' dark-mode' : ''}${isExpanded ? ' expanded' : ''}`}
          >
            <header className="chatbot-header">
              <span>
                ORION <span className="fa-purple">Field Assistant</span>
              </span>
              <div className="header-actions">
                <button onClick={toggleTheme} title="Toggle theme" className="icon-btn icon-theme" />
                <button
                  onClick={() => {
                    setMessages([]);
                    localStorage.removeItem('chatMessages');
                    setFeedback({});
                  }}
                  title="Clear chat"
                  className="icon-btn icon-refresh"
                />
                <button
                  onClick={() => setIsExpanded(e => !e)}
                  title={isExpanded ? 'Collapse window' : 'Expand window'}
                  className={`icon-btn ${isExpanded ? 'icon-collapse' : 'icon-expand'}`}
                />
              </div>
            </header>

            <ul className="chatbox" ref={chatRef}>
              {messages.map((msg, idx) => (
                <li
                  key={idx}
                  className={`chat ${msg.role === 'user' ? 'outgoing' : 'incoming'}`}
                >
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.text}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="feedback-row">
                      <button
                        className={`feedback-btn${feedback[idx] === 'up' ? ' selected' : ''}`}
                        onClick={() => handleFeedback(idx, 'up')}
                        disabled={!!feedback[idx]}
                        aria-label="Thumbs up"
                      >
                        <span className="icon-feedback-up" />
                      </button>
                      <button
                        className={`feedback-btn${feedback[idx] === 'down' ? ' selected' : ''}`}
                        onClick={() => handleFeedback(idx, 'down')}
                        disabled={!!feedback[idx]}
                        aria-label="Thumbs down"
                      >
                        <span className="icon-feedback-down" />
                      </button>
                    </div>
                  )}
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
              Powered by <img src={ZSIcon} alt="ZS Associates" />
            </footer>

            {toast && <div className="toast">{toast}</div>}
          </div>
        )}
      </div>
    </>
  );
};

export default ChatBot;
