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

  // Universal handler for sending user messages (input or suggestion)
  const handleSendMessage = async (userMessage) => {
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    localStorage.setItem('chatMessages', JSON.stringify(newMessages));
    setInput('');

    // Show loading message
    const pendingList = [...newMessages, { role: 'assistant', text: '⏳ Working on your request...' }];
    setMessages(pendingList);
    localStorage.setItem('chatMessages', JSON.stringify(pendingList));

    // Send to local proxy!
    let responseText;
    try {
      const response = await fetch('http://localhost:4000/api/snowflake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: userMessage })
      });
      responseText = await response.text();
    } catch (err) {
      responseText = "⚠️ Unable to connect to backend.";
    }

    // Replace loading with real response
    const updatedMessages = [...newMessages, { role: 'assistant', text: responseText }];
    setMessages(updatedMessages);
    localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
  };

  // Feedback handlers
  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    setToast('Thanks for your feedback!');
    setTimeout(() => setToast(''), 1100);
    // Optionally: send feedback to analytics here
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
          {isOpen ? '✖' : <img src={ChatbotIcon} alt="Chatbot" style={{ width: 48, height: 48 }} />}
        </button>
        {isOpen && (
          <div
            className={`chatbot modern-chatbot${darkMode ? ' dark-mode' : ''}`}
            style={{
              position: 'fixed',
              right: '20px',
              bottom: '80px',
              width: isExpanded ? '95vw' : '90vw',
              height: isExpanded ? '80vh' : '70vh',
              maxWidth: isExpanded ? '600px' : '400px',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              zIndex: 9999
            }}>

            <header className="chatbot-header">
              <span style={{ fontWeight: 600 }}>
                ORION <span style={{ color: '#6b38fb' }}>Field Assistant</span>
              </span>
              <div className="header-actions">
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  title="Toggle theme"
                  className="header-action-btn"
                  aria-label="Toggle theme"
                >
                  {darkMode ? (
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="5" fill="#7c3aed" />
                      <g stroke="#7c3aed" strokeWidth="2">
                        <line x1="12" y1="2" x2="12" y2="5" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
                        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                        <line x1="2" y1="12" x2="5" y2="12" />
                        <line x1="19" y1="12" x2="22" y2="12" />
                        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
                      </g>
                    </svg>
                  ) : (
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 0010.02 9.79z" fill="#7c3aed" />
                    </svg>
                  )}
                </button>
                {/* Refresh */}
                <button
                  onClick={() => {
                    setMessages([]);
                    localStorage.removeItem('chatMessages');
                    setFeedback({});
                  }}
                  title="Clear chat"
                  className="header-action-btn"
                  aria-label="Clear chat"
                >
                  <svg width="23" height="23" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                    <path d="M4.93 4.93a10 10 0 1014.14 0M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {/* Expand/Collapse */}
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title={isExpanded ? 'Collapse window' : 'Expand window'}
                  className="header-action-btn"
                  aria-label={isExpanded ? 'Collapse window' : 'Expand window'}
                >
                  {isExpanded ? (
                    <svg width="23" height="23" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                      <polyline points="8 3 3 3 3 8" />
                      <line x1="3" y1="3" x2="10" y2="10" />
                      <polyline points="16 21 21 21 21 16" />
                      <line x1="21" y1="21" x2="14" y2="14" />
                    </svg>
                  ) : (
                    <svg width="23" height="23" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              </div>
            </header>

            <ul className="chatbox" ref={chatRef}>
              {messages.map((msg, idx) => (
                <li
                  key={idx}
                  className={`chat ${msg.role === 'user' ? 'outgoing' : 'incoming'}`}
                  style={{
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    animation: 'fadeIn 0.25s cubic-bezier(.36,1.7,.72,.97)'
                  }}
                >
                  <div
                    className={`chat-bubble ${msg.role}`}
                    style={{
                      background: msg.role === 'user'
                        ? 'linear-gradient(95deg, #7c3aed 60%, #a78bfa 100%)'
                        : 'linear-gradient(135deg, #f0f4ff, #e9e8fe)',
                      color: msg.role === 'user' ? '#fff' : '#23234a',
                      borderTopRightRadius: msg.role === 'user' ? 22 : 16,
                      borderTopLeftRadius: msg.role === 'assistant' ? 22 : 16,
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      position: 'relative'
                    }}
                  >
                    {msg.text}
                  </div>
                  {/* Feedback buttons only for assistant responses */}
                  {msg.role === 'assistant' && (
                    <div className="feedback-row">
                      {feedback[idx] === undefined && (
                        <>
                          <button
                            className="feedback-btn"
                            onClick={() => handleFeedback(idx, 'up')}
                            aria-label="Thumbs up"
                          >👍</button>
                          <button
                            className="feedback-btn"
                            onClick={() => handleFeedback(idx, 'down')}
                            aria-label="Thumbs down"
                          >👎</button>
                        </>
                      )}
                      {feedback[idx] === 'up' && (
                        <button className="feedback-btn selected" aria-label="Thumbs up">👍</button>
                      )}
                      {feedback[idx] === 'down' && (
                        <button className="feedback-btn selected" aria-label="Thumbs down">👎</button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(s)}
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
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(input)}
                rows={1}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
              ></textarea>
              <button onClick={() => handleSendMessage(input)} title="Send message" className="send-button">
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
