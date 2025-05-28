import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ZSIcon from '../assets/ZS_Associates.png';

// Hardcoded answers (business questions)
const HARDCODED_ANSWERS = {
"where can i find top 10 gainer prescriber over time?": "Top 10 Gainer Prescribers can be found in the Performance Dossier.",
"what is formulary status?": "Formulary Status is the 'MMIT Pharmacy field which shows Preferred/Covered combined with PA/ST Restrictions.",
"what are the number of current monthly suggestion kpi?": "It is the 'Count of monthly suggestions (Call and RTE) for a prescriber.",
"which dossier gives a detailed analysis about the payors?": "You can find detailed analysis about Payor data in the Payor Highlights dossier.",
"where can i find explanations about different kpis?": "Explanations and Calculation of each and every KPI can be found in the Glossary dossier.",
"what is mkt % lis?": "Mkt % LIS in the Percentage of claims where claim type is 'PAID' and channel is 'Medicare' and 'Medicare D', and OPC = $0 - $12 and LIS patient flag = LIS-DE , LIS LTC, LIS-NON-DE, LIS-UNKNOWN for Rolling 3M.",
"which universes do we show in accounts calculation?": "We show three universes Veeva Aligned, Call Plan/DMCP and a combined Veeva Aligned + Call Plan/DMCP universes.",
"where can i find trx sales trends overtime?": "The sales trends for Retail and Non Retail sales can be found in the Performance Dossier."
};

const HARDCODED_SUGGESTIONS = [
"Where can I find top 10 Gainer Prescriber over time?",
"What is Formulary Status?",
"What are the Number of Current Monthly suggestion KPI?",
"Which dossier gives a detailed analysis about the Payors?",
"Where can I find explanations about different KPIS?",
"What is Mkt % LIS?",
"Which universes do we show in Accounts calculation?",
"Where can I find TRX Sales trends overtime?"
];

// Helper: Format response for plain text fallback (errors, etc)
function formatSnowflakeResponse(responseText) {
  try {
    const json = JSON.parse(responseText);

    if (json.error) return "❌ Error: " + json.error;
    if (
      json.code &&
      json.code !== "000000" &&
      (!json.message || !json.message.toLowerCase().includes("executed successfully"))
    ) {
      return `❌ Error: ${json.code} - ${json.message}`;
    }
    if (json.message) return json.message;
    return "No data found.";
  } catch {
    return responseText || "No response from Snowflake.";
  }
}

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }];
  });

  const [feedback, setFeedback] = useState({});
  // Suggestion index for rotating hardcoded suggestions
  const [suggestionIndex, setSuggestionIndex] = useState(() => {
    const stored = localStorage.getItem('suggestionIndex');
    return stored ? parseInt(stored, 10) : 0;
  });

  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const chatRef = useRef();
  const inputRef = useRef();

  // Only show 4 rotating suggestions at a time
  const visibleSuggestions = Array(4)
    .fill(0)
    .map((_, i) => HARDCODED_SUGGESTIONS[(suggestionIndex + i) % HARDCODED_SUGGESTIONS.length]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Send user message to backend and update chat
  const handleSendMessage = async (userMessage) => {
    if (!userMessage.trim()) return;
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    localStorage.setItem('chatMessages', JSON.stringify(newMessages));
    setInput('');

    // HARDCODED ANSWER CHECK
    const cleaned = userMessage.trim().toLowerCase();
    const matchedKey = Object.keys(HARDCODED_ANSWERS).find(
      k => cleaned.includes(k)
    );
    if (matchedKey) {
      const hardcodedAnswer = HARDCODED_ANSWERS[matchedKey];
      const updatedMessages = [...newMessages, { role: 'assistant', text: hardcodedAnswer }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      return;
    }

    // Show loading message
    const pendingList = [...newMessages, { role: 'assistant', text: '⏳ Querying Snowflake...' }];
    setMessages(pendingList);
    localStorage.setItem('chatMessages', JSON.stringify(pendingList));

    // Send to Node proxy backend
    try {
      const response = await fetch('http://localhost:4000/api/snowflake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: userMessage })
      });
      const responseText = await response.text();

      // Save BOTH the pretty text and raw JSON in the message
      const formatted = formatSnowflakeResponse(responseText);
      const updatedMessages = [...newMessages, { role: 'assistant', text: formatted, rawJson: responseText }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    } catch (err) {
      const formatted = "⚠️ Unable to connect to backend.";
      const updatedMessages = [...newMessages, { role: 'assistant', text: formatted }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    }
  };

  // Feedback handlers
  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    setToast('Thanks for your feedback!');
    setTimeout(() => setToast(''), 1100);
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  // Core chat bubble renderer
  const renderChatBubbleContent = (msg) => {
    // Try to render as HTML table if possible (from rawJson)
    if (msg.rawJson) {
      try {
        const json = JSON.parse(msg.rawJson);
        const columns =
          (json.resultSetMetaData && json.resultSetMetaData.rowType && json.resultSetMetaData.rowType.map(col => col.name)) ||
          (json.rowType && json.rowType.map(col => col.name)) ||
          (json.rowtype && json.rowtype.map(col => col.name)) ||
          (json.columns && json.columns.map(col => col.name));
        const data = json.data;
        if (Array.isArray(columns) && columns.length > 0 && Array.isArray(data)) {
          return (
            <table className="snowflake-table">
              <thead>
                <tr>
                  {columns.map((h, i) => <th key={i}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: '#888' }}>(no results)</td></tr>
                ) : data.map((row, ridx) => (
                  <tr key={ridx}>
                    {row.map((cell, cidx) => (
                      <td key={cidx} style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: typeof cell === "string" && cell.trim().startsWith('[') ? "monospace" : undefined
                      }}>
                        {(() => {
                          try {
                            if (typeof cell === "string" && (cell.trim().startsWith('[') || cell.trim().startsWith('{'))) {
                              const parsed = JSON.parse(cell);
                              if (Array.isArray(parsed)) {
                                return (
                                  <ul style={{ paddingLeft: '18px', margin: 0 }}>
                                    {parsed.map((item, idx) => <li key={idx}>{item}</li>)}
                                  </ul>
                                );
                              }
                              if (typeof parsed === 'object') {
                                return <pre>{JSON.stringify(parsed, null, 2)}</pre>;
                              }
                            }
                            return cell;
                          } catch {
                            return cell;
                          }
                        })()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
      } catch {}
    }
    // Fallback: plain text (with newlines)
    return msg.text.split('\n').map((line, i) => (
      <div key={i}>{line}</div>
    ));
  };

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
            className={
              `chatbot modern-chatbot` +
              (darkMode ? ' dark-mode' : '') +
              (isExpanded ? ' expanded' : ' collapsed')
            }
          >
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
                    // Rotate suggestions
                    const newIndex = (suggestionIndex + 4) % HARDCODED_SUGGESTIONS.length;
                    setSuggestionIndex(newIndex);
                    localStorage.setItem('suggestionIndex', newIndex.toString());
                    setMessages([{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }]);
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
                    {renderChatBubbleContent(msg)}
                  </div>
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
              {visibleSuggestions.map((s, i) => (
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
                rows={2}
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
