
import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ZSIcon from '../assets/ZS_Associates.png';

const HARDCODED_ANSWERS = {
  "where can i find top 10 gainer prescriber over time?": "Top 10 Gainer Prescribers can be found in the Performance Dossier.",
  "what is formulary status?": "Formulary Status is the 'MMIT Pharmacy field which shows Preferred/Covered combined with PA/ST Restrictions.",
  "what are the number of current monthly suggestion kpi?": "It is the 'Count of monthly suggestions (Call and RTE) for a prescriber.",
  "which dossier gives a detailed analysis about the payors?": "You can find detailed analysis about Payor data in the Payor Highlights dossier.",
  "where can i find explanations about different kpis?": "Explanations and Calculation of each and every KPI can be found in the Glossary dossier.",
  "what is mkt % lis?": "Mkt % LIS in the Percentage of claims where claim type is 'PAID' and channel is 'Medicare' and 'Medicare D', and OPC = $0 - $12 and LIS patient flag = LIS-DE , LIS LTC, LIS-NON-DE, LIS-UNKNOWN for Rolling 3M.",
  "which universes do we show in accounts calculation?": "We show three universes Veeva Aligned, Call Plan/DMCP and a combined Veeva Aligned + Call Plan/DMCP universes.",
  "where can i find trx sales trends overtime?": "The sales trends for Retail and Non Retail sales can be found in the Performance Dossier.",
  "are any physicians' sales dropped at a geo level?": "PDRP stands for Prescriber Data Restriction Program. Any prescriber who opts into the PDRP has their sales reported as zero. Sales from prescribers who have opted into the PDRP are included in the geography aggregation. If a geographic area has fewer than three actual PDRP participants, additional prescribers are randomly masked to simulate actual PDRP participation. Any prescriber masked as a PDRP in the R4W period remains masked for all other time periods."
};

const HARDCODED_SUGGESTIONS = [
  "Which universes do we show in Accounts calculation?",
  "Where can I find TRX Sales trends overtime?",
  "Where can I find top 10 Gainer Prescriber over time?",
  "What is Formulary Status?",
  "What are the number of current monthly suggestion KPIs?",
  "Which dossier gives a detailed analysis about the Payors?",
  "Where can I find explanations about different KPIs?",
  "What is MKT % LIS?",
  "Are any physicians' sales dropped at a geo level?"
];

const GENERIC_GREETINGS = [
  "hi", "hello", "hey", "how are you", "good morning", "good afternoon", "good evening",
  "hiya", "yo", "hii", "hello there", "hey there", "hi there"
];

function isGreeting(text) {
  const cleaned = text.trim().toLowerCase();
  return GENERIC_GREETINGS.some(g => cleaned === g || cleaned.startsWith(g + ' '));
}

function formatSnowflakeResponse(responseText) {
  try {
    let json = JSON.parse(responseText);

    if (
      json.resultSetMetaData &&
      json.resultSetMetaData.rowType &&
      json.resultSetMetaData.rowType.length === 1 &&
      /^CUSTOM_AGENT/i.test(json.resultSetMetaData.rowType[0].name) &&
      Array.isArray(json.data) &&
      json.data.length > 0 &&
      json.data[0][0]
    ) {
      try {
        const cellValue = json.data[0][0];
        const agentObj = JSON.parse(cellValue);
        if (typeof agentObj.output === "string") {
          return { type: "output", value: agentObj.output };
        }
      } catch (e) {
        return { type: "output", value: json.data[0][0] };
      }
    }

    const agentKey = Object.keys(json).find(key => key.startsWith("CUSTOM_AGENT"));
    if (agentKey && typeof json[agentKey] === "string") {
      try {
        const agentObj = JSON.parse(json[agentKey]);
        if (typeof agentObj.output === "string") {
          return { type: "output", value: agentObj.output };
        }
        return { type: "json", value: agentObj };
      } catch {
        return { type: "output", value: json[agentKey] };
      }
    }

    const columns =
      (json.resultSetMetaData && json.resultSetMetaData.rowType && json.resultSetMetaData.rowType.map(col => col.name)) ||
      (json.rowType && json.rowType.map(col => col.name)) ||
      (json.rowtype && json.rowtype.map(col => col.name)) ||
      (json.columns && json.columns.map(col => col.name));
    const data = json.data;
    if (Array.isArray(columns) && columns.length > 0 && Array.isArray(data)) {
      return {
        type: "table",
        columns,
        data
      };
    }

    if (json.error) return { type: "error", value: "❌ Error: " + json.error };
    if (
      json.code &&
      json.code !== "000000" &&
      (!json.message || !json.message.toLowerCase().includes("executed successfully"))
    ) {
      return { type: "error", value: `❌ Error: ${json.code} - ${json.message}` };
    }
    if (json.message) return { type: "output", value: json.message };

    return { type: "output", value: "No data found." };
  } catch {
    return { type: "error", value: responseText || "No response from Snowflake." };
  }
}

// --- Typing Indicator Component ---
function TypingIndicator() {
  return (
    <span className="typing-indicator">
      <span></span><span></span><span></span>
    </span>
  );
}

// Tooltip helper
const Tooltip = ({ children, text }) => (
  <span className="feedback-tooltip">
    {children}
    <span className="feedback-tooltiptext">{text}</span>
  </span>
);

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }];
  });

  const [feedback, setFeedback] = useState({});
  const [suggestionIndex, setSuggestionIndex] = useState(() => {
    const stored = localStorage.getItem('suggestionIndex');
    return stored ? parseInt(stored, 10) : 0;
  });
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const [clickedIndex, setClickedIndex] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef();
  const inputRef = useRef();

  // Suggestion randomizer for clear chat
  const randomizeSuggestions = () => {
    let newIndex = Math.floor(Math.random() * HARDCODED_SUGGESTIONS.length);
    if (HARDCODED_SUGGESTIONS.length > 1 && newIndex === suggestionIndex) {
      newIndex = (newIndex + 1) % HARDCODED_SUGGESTIONS.length;
    }
    setSuggestionIndex(newIndex);
    localStorage.setItem('suggestionIndex', newIndex.toString());
  };

  // 2 or 4 suggestions based on expansion
  const numSuggestions = isExpanded ? 4 : 2;
  const visibleSuggestions = Array(numSuggestions)
    .fill(0)
    .map((_, i) => HARDCODED_SUGGESTIONS[(suggestionIndex + i) % HARDCODED_SUGGESTIONS.length]);

  // Scroll chat to bottom on update
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isOpen, isExpanded]);

  // Prevent input scrolling
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.value.length * 8;
    }
  }, [input]);

  // Auto-hide toast
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(t => ({ ...t, visible: false }));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const showToast = (msg, type) => {
    setToast({ message: msg, type: type, visible: true });
  };

  const handleSendMessage = async (userMessage) => {
    if (!userMessage.trim()) return;
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    localStorage.setItem('chatMessages', JSON.stringify(newMessages));
    setInput('');
    setIsTyping(true);

    if (isGreeting(userMessage)) {
      const greetingResponse =
        "Hello! 👋 How can I assist you with your field insights or business data today?";
      setTimeout(() => {
        setIsTyping(false);
        const updatedMessages = [...newMessages, { role: 'assistant', text: greetingResponse }];
        setMessages(updatedMessages);
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      }, 700);
      return;
    }

    // HARDCODED business mode answers
    const cleaned = userMessage.trim().toLowerCase();
    const matchedKey = Object.keys(HARDCODED_ANSWERS).find(
      k => cleaned.includes(k)
    );
    if (matchedKey) {
      const hardcodedAnswer = HARDCODED_ANSWERS[matchedKey];
      setTimeout(() => {
        setIsTyping(false);
        const updatedMessages = [...newMessages, { role: 'assistant', text: hardcodedAnswer }];
        setMessages(updatedMessages);
        localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      }, 650);
      return;
    }

    // Show typing indicator (no pending message in chat)
    const isLikelySQL = userMessage.trim().toLowerCase().startsWith('select')
      || userMessage.trim().toLowerCase().startsWith('show')
      || userMessage.trim().toLowerCase().startsWith('desc')
      || userMessage.trim().toLowerCase().startsWith('describe');

    try {
      let body = isLikelySQL
        ? { statement: userMessage }
        : { statement: `CALL CUSTOM_AGENT2('${userMessage.replace(/'/g, "''")}');` };

      const response = await fetch('http://localhost:4000/api/snowflake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const responseText = await response.text();
      const formatted = formatSnowflakeResponse(responseText);

      setIsTyping(false);
      const updatedMessages = [
        ...newMessages,
        {
          role: 'assistant',
          text: formatted,
        }
      ];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    } catch (err) {
      setIsTyping(false);
      const formatted = { type: "error", value: "⚠️ Unable to connect to backend." };
      const updatedMessages = [...newMessages, { role: 'assistant', text: formatted }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
    }
  };

  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    showToast(type === "up" ? "Marked as helpful!" : "Marked as not helpful!", type === "up" ? "success" : "error");
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  // Render assistant output
  const renderChatBubbleContent = (msg) => {
    if (typeof msg.text === "object" && msg.text !== null) {
      const obj = msg.text;
      if (obj.type === "table") {
        return (
          <table className="snowflake-table">
            <thead>
              <tr>
                {obj.columns.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {obj.data.length === 0 ? (
                <tr>
                  <td colSpan={obj.columns.length} style={{ textAlign: 'center', color: '#888' }}>(no results)</td>
                </tr>
              ) : obj.data.map((row, ridx) => (
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
      if (obj.type === "output") {
        return <div>{obj.value}</div>;
      }
      if (obj.type === "error") {
        return <span style={{ color: "#b91c1c", fontWeight: 500 }}>{obj.value}</span>;
      }
      return <pre>{JSON.stringify(obj.value, null, 2)}</pre>;
    }
    return (msg.text || "").split('\n').map((line, i) => (
      <div key={i}>{line}</div>
    ));
  };

  // Suggestion button microinteraction
  const handleSuggestionClick = (s, i, e) => {
    setClickedIndex(i);
    setTimeout(() => setClickedIndex(null), 220);
    handleSendMessage(s);
  };

  // Main render
  return (
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
            <span className="header-title">
              Field Insights<span className="header-title-gradient"> Assistant</span>
            </span>
            <div className="header-controls">
              <div className="header-actions">
                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  title="Toggle theme"
                  className="header-action-btn"
                  aria-label="Toggle theme"
                >
                  {darkMode ? (
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
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
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 0010.02 9.79z" fill="#7c3aed" />
                    </svg>
                  )}
                </button>
                {/* Refresh/Clear + randomize suggestions */}
                <button
                  onClick={() => {
                    randomizeSuggestions();
                    setMessages([{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }]);
                    localStorage.removeItem('chatMessages');
                    setFeedback({});
                  }}
                  title="Clear chat"
                  className="header-action-btn"
                  aria-label="Clear chat"
                >
                  <svg width="25" height="25" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
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
                    <svg width="25" height="25" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                      <polyline points="8 3 3 3 3 8" />
                      <line x1="3" y1="3" x2="10" y2="10" />
                      <polyline points="16 21 21 21 21 16" />
                      <line x1="21" y1="21" x2="14" y2="14" />
                    </svg>
                  ) : (
                    <svg width="25" height="25" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </header>
          <ul className="chatbox" ref={chatRef}>
            {messages.map((msg, idx) => (
              <li
                key={idx}
                className={`chat ${msg.role === 'user' ? 'outgoing' : 'incoming'}`}
                style={{
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div className={`chat-bubble ${msg.role}`}>
                  {renderChatBubbleContent(msg)}
                </div>
                {msg.role === 'assistant' && (
                  <div className="feedback-row">
                    {feedback[idx] === undefined && (
                      <>
                        <Tooltip text="Mark as helpful">
                          <button
                            className="feedback-btn"
                            onClick={() => handleFeedback(idx, 'up')}
                            aria-label="Thumbs up"
                            tabIndex={0}
                          >👍</button>
                        </Tooltip>
                        <Tooltip text="Mark as not helpful">
                          <button
                            className="feedback-btn"
                            onClick={() => handleFeedback(idx, 'down')}
                            aria-label="Thumbs down"
                            tabIndex={0}
                          >👎</button>
                        </Tooltip>
                      </>
                    )}
                    {feedback[idx] === 'up' && (
                      <Tooltip text="Marked as helpful!">
                        <button className="feedback-btn selected up" aria-label="Thumbs up" tabIndex={0}>👍</button>
                      </Tooltip>
                    )}
                    {feedback[idx] === 'down' && (
                      <Tooltip text="Marked as not helpful">
                        <button className="feedback-btn selected down" aria-label="Thumbs down" tabIndex={0}>👎</button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </li>
            ))}
            {/* Typing indicator */}
            {isTyping && (
              <li className="chat incoming">
                <div className="chat-bubble assistant">
                  <TypingIndicator />
                </div>
              </li>
            )}
          </ul>
          {/* Suggestions panel now at the bottom */}
          <div className="suggestions" style={{ position: "relative" }}>
            {visibleSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={e => handleSuggestionClick(s, i, e)}
                className={`suggestion-button${clickedIndex === i ? ' clicked' : ''}`}
              >
                {s}
              </button>
            ))}
            { !isExpanded &&
              <button
                className="suggestion-arrow right"
                aria-label="Next suggestions"
                onClick={() => {
                  const max = HARDCODED_SUGGESTIONS.length;
                  setSuggestionIndex((prev) => (prev + 1) % max);
                  localStorage.setItem(
                    "suggestionIndex",
                    ((suggestionIndex + 1) % max).toString()
                  );
                }}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  marginLeft: 7,
                  color: "#7c3aed",
                  alignSelf: "center",
                  height: 28,
                  width: 28
                }}
              >&#8594;</button>
            }
          </div>
          <div className="chat-input">
            <textarea
              ref={inputRef}
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage(input)}
              rows={1}
              className="chat-input-textarea"
              style={{overflow: 'hidden', resize: 'none'}}
            />
            <button
              onClick={() => handleSendMessage(input)}
              title="Send message"
              className={`send-button${input.trim() ? " has-text" : ""}`}
            >
              {/* SVG send icon */}
              <svg height="22" width="22" viewBox="0 0 24 24" fill="none" style={{display:"block"}}>
                <path d="M4 20L20 12L4 4V10L16 12L4 14V20Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          {/* Toast notification inside chatbox */}
          {toast.visible && (
            <div
              className={`toast toast-${toast.type}`}
              onClick={() => setToast(t => ({ ...t, visible: false }))}
              style={{cursor:'pointer'}}
            >
              {toast.message}
            </div>
          )}
          <footer className="chatbot-footer">
            Powered by <img src={ZSIcon} alt="ZS Associates" />
          </footer>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
