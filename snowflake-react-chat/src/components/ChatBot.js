import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ZSIcon from '../assets/ZS_Associates.png';

const HARDCODED_ANSWERS = {
  // ... your hardcoded answers as before
  "where can i find top 10 gainer prescriber over time?": "Top 10 Gainer Prescribers can be found in the Performance Dossier.",
  "what is formulary status?": "Formulary Status is the 'MMIT Pharmacy field which shows Preferred/Covered combined with PA/ST Restrictions.",
  "what are the number of current monthly suggestion kpi?": "It is the 'Count of monthly suggestions (Call and RTE) for a prescriber.",
  "which dossier gives a detailed analysis about the payors?": "You can find detailed analysis about Payor data in the Payor Highlights dossier.",
  "where can i find explanations about different kpis?": "Explanations and Calculation of each and every KPI can be found in the Glossary dossier.",
  "what is mkt % lis?": "Mkt % LIS is the Percentage of claims where claim type is 'PAID' and channel is 'Medicare' and 'Medicare D', and OPC = $0 - $12 and LIS patient flag = LIS-DE, LIS LTC, LIS-NON-DE, LIS-UNKNOWN for Rolling 3M.",
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

function formatSnowflakeResponse(responseText) {
  try {
    let json = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
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
    return { type: "error", value: responseText || "No response from backend." };
  }
}

function extractSQLBlock(text) {
  const match = text && text.match(/```sql\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

function TypingIndicator() {
  return (
    <span className="typing-indicator">
      <span></span><span></span><span></span>
    </span>
  );
}

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
  const [isTyping, setIsTyping] = useState(false);

  // Suggestion & refinement state
  const [clarifySuggestions, setClarifySuggestions] = useState([]);
  const [canFinalize, setCanFinalize] = useState(false);

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

  const numSuggestions = isExpanded ? 4 : 2;
  const visibleSuggestions = Array(numSuggestions)
    .fill(0)
    .map((_, i) => HARDCODED_SUGGESTIONS[(suggestionIndex + i) % HARDCODED_SUGGESTIONS.length]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isOpen, isExpanded, clarifySuggestions]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.value.length * 8;
    }
  }, [input]);

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

  // === CLARIFY/REFINE & FINALIZE LOGIC ===
  const handleSendMessage = async (userMessage, fromSuggestion = false) => {
    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) return;
    setInput('');
    setIsTyping(true);

    // HARDCODED ANSWERS - instant, no API
    const cleaned = userMessage.trim().toLowerCase();
    const matchedKey = Object.keys(HARDCODED_ANSWERS).find(k => cleaned.includes(k));
    if (matchedKey) {
      setIsTyping(false);
      setCanFinalize(false);
      setClarifySuggestions([]);
      const updatedMessages = [...messages, { role: 'user', text: userMessage }, { role: 'assistant', text: HARDCODED_ANSWERS[matchedKey] }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      return;
    }

    // REFINEMENT: Go to OpenAI clarify endpoint, show suggestions, allow further edits/convo
    const updatedMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(updatedMessages);

    const response = await fetch('http://localhost:4000/api/clarify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage })
    });
    const { assistant_message, suggestions } = await response.json();

    if (suggestions && suggestions.length > 0) {
      setIsTyping(false);
      setCanFinalize(true); // allow "Proceed" from now on
      setClarifySuggestions(suggestions);
      setMessages([
        ...updatedMessages,
        { role: 'assistant', text: assistant_message }
      ]);
      return;
    }
    setIsTyping(false);
    setCanFinalize(true);
    setClarifySuggestions([]);
    setMessages([
      ...updatedMessages,
      { role: 'assistant', text: assistant_message || "Could you clarify your query?" }
    ]);
    return;
  };

  // When suggestion is clicked: fill input, don't send!
  const handleSuggestionToInput = (sugg) => {
    setInput(sugg);
    if (inputRef.current) inputRef.current.focus();
  };

  // On "Proceed" (finalize) send to Snowflake
  const handleProceed = async () => {
    const messageToSend = input.trim();
    if (!messageToSend) return;
    setIsTyping(true);
    setCanFinalize(false);
    setClarifySuggestions([]);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: messageToSend }]);
    let sql = extractSQLBlock(messageToSend) || messageToSend;
    let body = { statement: `CALL CUSTOM_AGENT2('${sql.replace(/'/g, "''")}')` };
    const response = await fetch('http://localhost:4000/api/snowflake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const responseText = await response.text();
    const formatted = formatSnowflakeResponse(responseText);

    setIsTyping(false);
    setMessages(prev => [
      ...prev,
      { role: "assistant", text: "Fetched results from Snowflake..." },
      { role: "assistant", text: formatted }
    ]);
  };

  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    showToast(type === "up" ? "Marked as helpful!" : "Marked as not helpful!", type === "up" ? "success" : "error");
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  // --- UPDATED: renderChatBubbleContent, cleanly handle CUSTOM_AGENT2 output ---
  const renderChatBubbleContent = (msg) => {
    if (typeof msg.text === "string" && msg.text.startsWith("CUSTOM_AGENT2")) {
      const match = msg.text.match(/CUSTOM_AGENT2\s*({[\s\S]+})/);
      if (match) {
        try {
          const obj = JSON.parse(match[1]);
          if (obj && obj.output) return <div>{obj.output}</div>;
        } catch (e) {
          return <pre style={{ color: "#b91c1c" }}>Invalid agent output format</pre>;
        }
      }
    }
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
    // SQL/code blocks
    if (typeof msg.text === "string") {
      const sqlBlock = extractSQLBlock(msg.text);
      if (sqlBlock) {
        return (
          <div className="assistant-output-block" style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Snowflake SQL Query:</div>
            <pre className="assistant-sql-block" style={{
              marginBottom: 8,
              borderRadius: 12,
              background: '#f5f2fd',
              padding: 15,
              fontSize: 14,
              overflowX: 'auto'
            }}>{sqlBlock}</pre>
            <button
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                border: 'none',
                background: '#ede7fa',
                borderRadius: 7,
                padding: '3px 10px',
                fontSize: 13,
                color: '#5233c0',
                cursor: 'pointer'
              }}
              onClick={() => handleCopy(sqlBlock)}
              title="Copy SQL"
            >
              Copy
            </button>
            <div style={{ color: '#444', marginTop: 10, fontSize: 14 }}>
              {msg.text.replace(/```sql[\s\S]*?```/i, '').trim()}
            </div>
          </div>
        );
      }
    }
    return (msg.text || "").split('\n').map((line, i) => (
      <div key={i}>{line}</div>
    ));
  };

  // Suggestions (after OpenAI, for refinement—DO NOT send)
  const renderClarifySuggestions = () => (
    <div className="clarify-suggestion-block">
      <div className="clarify-section-label">Suggestions:</div>
      <div className="suggestions">
        {clarifySuggestions.map((sugg, idx) => (
          <button
            key={idx}
            className="suggestion-button"
            onClick={() => handleSuggestionToInput(sugg)}
          >{sugg}</button>
        ))}
      </div>
    </div>
  );

  // Static suggestions (before first clarify)
  const renderHardcodedSuggestions = () => (
    <div className="suggestions" style={{ position: "relative" }}>
      {visibleSuggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => handleSendMessage(s, true)}
          className="suggestion-button"
        >
          {s}
        </button>
      ))}
      {!isExpanded &&
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
  );

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
                <button onClick={toggleTheme} title="Toggle theme" className="header-action-btn" aria-label="Toggle theme">
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
                <button
                  onClick={() => {
                    randomizeSuggestions();
                    setMessages([{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }]);
                    localStorage.removeItem('chatMessages');
                    setFeedback({});
                    setClarifySuggestions([]);
                    setCanFinalize(false);
                  }}
                  title="Clear chat"
                  className="header-action-btn"
                  aria-label="Clear chat"
                >
                  <svg width="25" height="25" fill="none" stroke="#7c3aed" strokeWidth="2.1" viewBox="0 0 24 24">
                    <path d="M4.93 4.93a10 10 0 1014.14 0M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
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
                style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
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
            {isTyping && (
              <li className="chat incoming">
                <div className="chat-bubble assistant">
                  <TypingIndicator />
                </div>
              </li>
            )}
          </ul>
          {/* Suggestions panel after OpenAI clarify */}
          {clarifySuggestions.length > 0 && renderClarifySuggestions()}
          {/* If not in clarify/refinement, show static suggestions */}
          {clarifySuggestions.length === 0 && renderHardcodedSuggestions()}
          {/* Main input is always present */}
          <div className="chat-input">
            <textarea
              ref={inputRef}
              placeholder="Ask me anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                }
              }}
              rows={1}
              className="chat-input-textarea"
              style={{ overflow: 'hidden', resize: 'none' }}
              disabled={isTyping}
              autoFocus={isOpen}
              aria-label="Type your message"
            />
            <button
              onClick={() => handleSendMessage(input)}
              title="Send message"
              className={`send-button${input.trim() ? " has-text" : ""}`}
              disabled={isTyping || !input.trim()}
              aria-label="Send"
            >
              <svg height="22" width="22" viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
                <path d="M4 20L20 12L4 4V10L16 12L4 14V20Z" fill="currentColor" />
              </svg>
            </button>
            {canFinalize && (
              <button
                className="finalize-button"
                onClick={handleProceed}
                disabled={isTyping || !input.trim()}
                aria-label="Proceed"
                title="Finalize and send to Snowflake"
                style={{ marginLeft: 6 }}
              >
                Proceed
              </button>
            )}
          </div>
          {toast.visible && (
            <div
              className={`toast toast-${toast.type}`}
              onClick={() => setToast(t => ({ ...t, visible: false }))}
              style={{ cursor: 'pointer' }}
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
