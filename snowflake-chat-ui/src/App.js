import { useState, useEffect, useRef } from 'react';
import './styles.css';

export default function App() {
  const [sql, setSql] = useState('SELECT CURRENT_DATE');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  const runQuery = async () => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', text: sql }]);
    try {
      const res = await fetch('http://localhost:5000/api/run-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const columns = data.resultSetMetaData?.rowType.map(col => col.name) || [];
      const formatted = data.data.map(row =>
        columns.map((col, i) => `${col}: ${row[i]}`).join('\n')
      );
      setMessages(prev => [...prev, { role: 'assistant', text: formatted.join('\n\n') }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
      setSql('');
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="app-container">
      <div className="chat-box">
        <h1 className="header">💬 Snowflake Chat</h1>
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={\`message \${msg.role}\`}>
              <div className="avatar">{msg.role === 'user' ? 'U' : 'A'}</div>
              <div className="bubble">
                {msg.role === 'user' ? <code>{msg.text}</code> : <pre>{msg.text}</pre>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="avatar">A</div>
              <div className="bubble loading">Running query...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="input-box">
          <textarea value={sql} onChange={e => setSql(e.target.value)} placeholder="Enter SQL..." />
          <button onClick={runQuery} disabled={loading || !sql.trim()}>{loading ? '...' : 'Send'}</button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}