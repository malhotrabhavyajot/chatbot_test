import React, { useEffect, useRef, useState } from 'react';
import '../styles/style.css';
import ChatbotIcon from '../assets/chatbot-toggler.png';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

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

function TypingIndicator() {
  return (
    <span className="typing-indicator">
      <span></span><span></span><span></span>
    </span>
  );
}

async function downloadSummaryDocx(messages) {
  const docChildren = [
    new Paragraph({
      children: [
        new TextRun({ text: "Field Insights Assistant - Full Chat Transcript", bold: true, size: 36 }),
        new TextRun({ text: "\n\n" }),
      ]
    }),
  ];

  messages.forEach((msg) => {
    if (!msg || !msg.role || !msg.text) return;
    docChildren.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: msg.role === "user" ? "User: " : "Assistant: ",
            bold: true,
            color: msg.role === "user" ? "426BBA" : "373D42"
          }),
          new TextRun({
            text: typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text, null, 2),
            color: "22223b",
          })
        ]
      })
    );
  });

  const doc = new Document({
    sections: [{ properties: {}, children: docChildren }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `chat-transcript-${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.docx`);
}

const ChatBot = () => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) return JSON.parse(saved);
    return [{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }];
  });

  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [togglerAnimClass, setTogglerAnimClass] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const [isTyping, setIsTyping] = useState(false);

  const chatRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (isOpen) {
      setTogglerAnimClass('opening');
      const timeout = setTimeout(() => setTogglerAnimClass(''), 230);
      return () => clearTimeout(timeout);
    } else {
      setTogglerAnimClass('closed');
      const timeout = setTimeout(() => setTogglerAnimClass(''), 230);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

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

    // Show user's message in chat
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);

    try {
      // 1. Clarify agent
      const clarifyRes = await fetch('http://localhost:5100/api/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage })
      });
      const { assistant_message, finalized } = await clarifyRes.json();

      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', text: assistant_message }]);

      if (!finalized) {
        // Wait for next user input (clarification step)
        return;
      }

      // 2. Parse the finalized query from clarify
      let finalizedPrompt = assistant_message;
      const match = finalizedPrompt.match(/"(.*?)"/s);
      if (match) finalizedPrompt = match[1];

      // 3. Prepare Analyst API input
      const analystBody = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: finalizedPrompt }
            ]
          }
        ],
        prompt: finalizedPrompt, // Used for beautify step
        semantic_model_file: "@CHATBOT_DEMO.CHATBOT_METADATA.STAGE_1/cortex_chatbot.yaml"
      };

      setIsTyping(true);

      // 4. Call Cortex Analyst pipeline (includes beautification)
      const analystRes = await fetch('http://localhost:5100/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analystBody)
      });
      const { beautified } = await analystRes.json();

      setIsTyping(false);

      // 5. Show beautified output
      // --- Core: Extract summary/insights/interpretation and create a chat string ---
      let beautifiedObj = beautified;
      if (beautified && typeof beautified === "string") {
        try {
          beautifiedObj = JSON.parse(beautified);
        } catch {
          beautifiedObj = { summary: beautified };
        }
      }
      if (!beautifiedObj || (typeof beautifiedObj === "string" && !beautifiedObj.trim())) {
        beautifiedObj = { summary: "Sorry, no data was returned from the server." };
      }
      let chatBubbleString = '';
      if (beautifiedObj && typeof beautifiedObj === 'object') {
        if (beautifiedObj.summary) chatBubbleString += beautifiedObj.summary + '\n\n';
        if (Array.isArray(beautifiedObj.keyInsights) && beautifiedObj.keyInsights.length > 0) {
          chatBubbleString += beautifiedObj.keyInsights.map(item => '• ' + item).join('\n') + '\n\n';
        }
        if (beautifiedObj.interpretation) chatBubbleString += beautifiedObj.interpretation;
      } else if (typeof beautifiedObj === 'string') {
        chatBubbleString = beautifiedObj;
      }
      chatBubbleString = chatBubbleString.trim();

      setMessages(prev => [
        ...prev,
        { role: "assistant", text: chatBubbleString }
      ]);
      localStorage.setItem(
        'chatMessages',
        JSON.stringify([
          ...messages,
          { role: 'user', text: userMessage },
          { role: 'assistant', text: assistant_message },
          { role: 'assistant', text: chatBubbleString }
        ])
      );
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', text: "Sorry, I couldn't process your query. Please try again." }]);
      return;
    }
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

const renderChatBubbleContent = (msg) => {
  // Handle beautified response as an object
  if (typeof msg.text === "object" && msg.text !== null) {
    const { summary, keyInsights, interpretation } = msg.text;

    return (
      <div style={{ whiteSpace: "pre-line" }}>
        {summary && <div style={{ marginBottom: keyInsights || interpretation ? 8 : 0 }}>{summary}</div>}
        {Array.isArray(keyInsights) && keyInsights.length > 0 && (
          <ul style={{ paddingLeft: 18, marginBottom: 8 }}>
            {keyInsights.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        )}
        {interpretation && <div style={{ marginTop: 8, color: "#666" }}>{interpretation}</div>}
      </div>
    );
  }

  // If text is a JSON string, try to parse and handle same as above
  if (typeof msg.text === "string") {
    let parsed = null;
    try {
      let cleaned = msg.text.replace(/^```json|^```|```$/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object") {
      const { summary, keyInsights, interpretation } = parsed;
      return (
        <div style={{ whiteSpace: "pre-line" }}>
          {summary && <div style={{ marginBottom: keyInsights || interpretation ? 8 : 0 }}>{summary}</div>}
          {Array.isArray(keyInsights) && keyInsights.length > 0 && (
            <ul style={{ paddingLeft: 18, marginBottom: 8 }}>
              {keyInsights.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          )}
          {interpretation && <div style={{ marginTop: 8, color: "#666" }}>{interpretation}</div>}
        </div>
      );
    }
    // Fallback: render as plain text
    return msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>);
  }

  // Final fallback
  return <div>{String(msg.text)}</div>;
};





  return (
    <div className={darkMode ? "otsuka-dark" : ""} style={{ background: 'var(--otsuka-bg-gradient)', minHeight: '100vh' }}>
      <button
        className={`chatbot-toggler modern-toggler ${togglerAnimClass}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chatbot"
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          zIndex: 10000,
          background: 'transparent',
          border: 'none',
          padding: 0,
          outline: 'none',
          boxShadow: 'none',
          borderRadius: 0,
          minWidth: 0,
          minHeight: 0,
          transition: "transform 0.25s cubic-bezier(.41,1.2,.5,1), opacity 0.23s cubic-bezier(.47,1.8,.7,.95)"
        }}
      >
        {isOpen ? (
          <span style={{
            fontSize: 44,
            color: '#B01C2E',
            fontWeight: 700,
            lineHeight: 1,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            ✖
          </span>
        ) : (
          <img
            src={ChatbotIcon}
            alt="Chatbot"
            className="chatbot-icon-animated"
            style={{
              height: 54,
              width: 54,
              display: 'block',
              background: 'none',
              border: 'none'
            }}
          />
        )}
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
                      <circle cx="12" cy="12" r="5" fill="#426BBA" />
                      <g stroke="#426BBA" strokeWidth="2">
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
                      <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 0010.02 9.79z" fill="#426BBA" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMessages([{ role: 'assistant', text: 'Hello 👋! How may I assist you?' }]);
                    localStorage.removeItem('chatMessages');
                  }}
                  title="Clear chat"
                  className="header-action-btn"
                  aria-label="Clear chat"
                >
                  <svg width="25" height="25" fill="none" stroke="#426BBA" strokeWidth="2.1" viewBox="0 0 24 24">
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
                    <svg width="25" height="25" fill="none" stroke="#426BBA" strokeWidth="2.1" viewBox="0 0 24 24">
                      <polyline points="8 3 3 3 3 8" />
                      <line x1="3" y1="3" x2="10" y2="10" />
                      <polyline points="16 21 21 21 21 16" />
                      <line x1="21" y1="21" x2="14" y2="14" />
                    </svg>
                  ) : (
                    <svg width="25" height="25" fill="none" stroke="#426BBA" strokeWidth="2.1" viewBox="0 0 24 24">
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
              onChange={e => {
                setInput(e.target.value);
                // Auto resize
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 110) + "px";
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(input);
                  setTimeout(() => {
                    if (inputRef.current) inputRef.current.style.height = "38px";
                  }, 80);
                }
              }}
              rows={1}
              className="chat-input-textarea"
              style={{
                overflow: "hidden",
                resize: "none",
                height: "38px",
                maxHeight: "80px"
              }}
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
          <footer className="chatbot-footer">
            <button
              onClick={() => downloadSummaryDocx(messages)}
              title="Download chat transcript"
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
                <path d="M12 16v-8M12 16l-4-4M12 16l4-4M4 20h16" stroke="#426BBA" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
