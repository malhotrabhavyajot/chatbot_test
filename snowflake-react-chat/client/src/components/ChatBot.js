import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import ChatSummaryChart from './ChatSummaryChart';

const HARDCODED_ANSWERS = {
  "where can i find top 10 gainer prescriber over time?": "Top 10 Gainer Prescribers can be found in the Performance Dossier.",
  "what is formulary status?": "Formulary Status is the 'MMIT Pharmacy field which shows Preferred/Covered combined with PA/ST Restrictions.",
  "what are the number of current monthly suggestion kpi?": "It is the 'Count of monthly suggestions (Call and RTE) for a prescriber.",
  "which dossier gives a detailed analysis about the payors?": "You can find detailed analysis about Payor data in the Payor Highlights dossier.",
  "where can i find explanations about different kpis?": "Explanations and Calculation of each and every KPI can be found in the Glossary dossier.",
  "what is mkt % lis?": "Mkt % LIS is the Percentage of claims where claim type is 'PAID' and channel is 'Medicare' and 'Medicare D', and OPC = $0 - $12 and LIS patient flag = LIS-DE, LIS LTC, LIS-NON-DE, LIS-UNKNOWN for Rolling 3M.",
  "which universes do we show in accounts calculation?": "We show three universes Veeva Aligned, Call Plan/DMCP and a combined Veeva Aligned + Call Plan/DMCP universes.",
  "where can i find trx sales trends overtime?": "The sales trends for Retail and Non Retail sales can be found in the Performance Dossier."
};

function formatSnowflakeResponse(responseText) {
  try {
    let json = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
    if (
      Array.isArray(json.data) &&
      json.data.length > 0 &&
      Array.isArray(json.data[0]) &&
      typeof json.data[0][0] === 'string' &&
      json.data[0][0].trim().startsWith('{')
    ) {
      const inner = JSON.parse(json.data[0][0]);
      if (inner.output) return { type: "output", value: inner.output };
      return { type: "output", value: JSON.stringify(inner, null, 2) };
    }
    if (json.output) return { type: "output", value: json.output };
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

function getMessageText(msg) {
  if (typeof msg.text === "string") return msg.text;
  if (msg.text && typeof msg.text === "object" && "value" in msg.text)
    return msg.text.value ?? JSON.stringify(msg.text);
  if (msg.text != null) return JSON.stringify(msg.text);
  return "";
}

// Download only the summary from API, not the full chat
async function downloadSummaryOnly(messages) {
  let summary = "No summary available.";
  try {
    const res = await fetch('https://chatbot-test-qwo8.onrender.com/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: messages })
    });
    const data = await res.json();
    summary = data.summary || summary;

    // If there is chart info, add a simple markdown visualization note to the file
    if (data.chartData && data.chartData.length > 0 && data.chartType) {
      summary += `\n\n---\n**Recommended Chart:** ${data.chartType.toUpperCase()} chart\n`;
      summary += `**Chart Data:**\n`;
      // Format as a markdown table
      const keys = Object.keys(data.chartData[0]);
      summary += `| ${keys.join(' | ')} |\n|${keys.map(() => '---').join('|')}|\n`;
      data.chartData.forEach(row => {
        summary += `| ${keys.map(k => row[k]).join(' | ')} |\n`;
      });
    }
  } catch (e) {
    // keep default
  }
  const header = "Field Insights Assistant - Chat Summary\n\n";
  const content = header + summary;
  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `chat-summary-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }];
  });

  const [feedback, setFeedback] = useState({});
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const [isTyping, setIsTyping] = useState(false);

  // State to track which chart visualizations are revealed
  const [revealedCharts, setRevealedCharts] = useState({});

  const chatRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, isOpen, isExpanded]);

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

  // ----------- MAIN LOGIC ----------------
  const handleSendMessage = async (userMessage) => {
    if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) return;
    setInput('');
    setIsTyping(true);

    // HARDCODED ANSWERS (instant, no LLM)
    const cleaned = userMessage.trim().toLowerCase();
    const matchedKey = Object.keys(HARDCODED_ANSWERS).find(k => cleaned.includes(k));
    if (matchedKey) {
      setIsTyping(false);
      const updatedMessages = [...messages, { role: 'user', text: userMessage }, { role: 'assistant', text: HARDCODED_ANSWERS[matchedKey] }];
      setMessages(updatedMessages);
      localStorage.setItem('chatMessages', JSON.stringify(updatedMessages));
      return;
    }

    // Summarize commands should be ignored in chat (do nothing)
    if (/summarize( the)? chat|give me a summary|chat summary/i.test(userMessage.trim())) {
      setIsTyping(false);
      return;
    }

    // Always send message to clarify endpoint
    const updatedMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(updatedMessages);

    try {
      const response = await fetch('https://chatbot-test-qwo8.onrender.com/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage })
      });
      const { assistant_message, finalized } = await response.json();

      if (finalized) {
        setMessages(prev => [...prev, { role: 'assistant', text: assistant_message }]);
        setIsTyping(true);

        let finalPrompt = assistant_message;
        if (typeof finalPrompt === "string" && /^["“”'].*["“”']$/.test(finalPrompt.trim())) {
          finalPrompt = finalPrompt.trim().replace(/^["“”']|["“”']$/g, "");
        }

        let body = { statement: `CALL CUSTOM_AGENT2('${finalPrompt.replace(/'/g, "''")}')` };
        const snowflakeRes = await fetch('https://chatbot-test-qwo8.onrender.com/api/snowflake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const responseText = await snowflakeRes.text();

        setIsTyping(false);

        // Parse for visualization
        let formatted = formatSnowflakeResponse(responseText);

        // If backend returns object with data/chartType, pass it through
        try {
          const json = JSON.parse(responseText);
          // If the backend returns visualizable JSON, show it as object
          if (json && (json.data && json.chartType)) {
            formatted = { type: "viz", value: json };
          }
        } catch { /* fallback to previous */ }

        setMessages(prev => [
          ...prev,
          { role: "assistant", text: formatted.type === "viz" ? formatted.value : formatted.value || "No response." }
        ]);
        return;
      } else {
        setIsTyping(false);
        setMessages(prev => [...prev, { role: 'assistant', text: assistant_message }]);
        return;
      }
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't process your query. Please try again." }]);
      return;
    }
  };

  const handleFeedback = (idx, type) => {
    setFeedback(prev => ({ ...prev, [idx]: type }));
    showToast(type === "up" ? "Marked as helpful!" : "Marked as not helpful!", type === "up" ? "success" : "error");
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  // --- Visualization-aware content rendering ---
  function renderChatBubbleContent(msg, idx) {
  // Visualization candidate
  if (
    typeof msg.text === "object" &&
    msg.text &&
    msg.text.data &&
    msg.text.chartType &&
    Array.isArray(msg.text.data)
  ) {
    return (
      <>
        <div>
          {msg.text.summary}
          {!revealedCharts[idx] && (
            <button
              onClick={() => setRevealedCharts(prev => ({ ...prev, [idx]: true }))}
              style={{
                marginTop: 16,
                marginLeft: 0,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                borderRadius: 12,
                padding: "7px 18px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 15,
                boxShadow: "0 1px 8px #a78bfa22"
              }}
            >
              Show visualization
            </button>
          )}
        </div>
        {revealedCharts[idx] && (
          <div style={{ marginTop: 14 }}>
            <ChatSummaryChart
              chartData={msg.text.data}
              chartType={msg.text.chartType}
              labelKey={msg.text.xKey}
              valueKey={msg.text.yKey}
            />
          </div>
        )}
      </>
    );
  }

  // If string, split lines
  if (typeof msg.text === "string") {
    return msg.text.split('\n').map((line, i) => (
      <div key={i}>{line}</div>
    ));
  }

  // If error object
  if (msg.text && typeof msg.text === "object" && msg.text.type === "error") {
    return (
      <span style={{ color: "#b91c1c", fontWeight: 500 }}>
        {msg.text.value}
      </span>
    );
  }

  // If plain object, show as JSON
  if (msg.text && typeof msg.text === "object") {
    return (
      <pre style={{ margin: 0, fontFamily: "monospace" }}>
        {JSON.stringify(msg.text, null, 2)}
      </pre>
    );
  }

  // Fallback
  return <span>{String(msg.text)}</span>;
}

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
                    setMessages([{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }]);
                    localStorage.removeItem('chatMessages');
                    setFeedback({});
                    setRevealedCharts({});
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
                  {renderChatBubbleContent(msg, idx)}
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
          </div>
<footer
  className="chatbot-footer"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
    minHeight: "40px",
    padding: "8px 0",
  }}
>
  {/* Download button absolutely positioned at left */}
  <button
    onClick={() => downloadSummaryOnly(messages)}
    title="Download summary"
    className="header-action-btn"
    aria-label="Download summary"
    style={{
      position: "absolute",
      left: 0,
      top: "45%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "0 0 0 12px",
      height: "100%",
      display: "flex",
      alignItems: "center"
    }}
  >
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path d="M12 16v-8M12 16l-4-4M12 16l4-4M4 20h16" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
</footer>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
