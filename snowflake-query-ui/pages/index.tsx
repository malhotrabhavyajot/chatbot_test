import { useState, useEffect, useRef } from 'react';

export default function QueryRunner() {
  const [sql, setSql] = useState('SELECT CURRENT_DATE');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const parseCell = (cell: any) => {
    try {
      const parsed = JSON.parse(cell);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => (Array.isArray(item) ? item.join(' - ') : item)).join(', ');
      }
    } catch (_) {
      // not JSON, return as-is
    }
    return cell;
  };

  const runQuery = async () => {
    setLoading(true);
    setError('');
    setMessages(prev => [...prev, { role: 'user', text: sql }]);

    try {
      const res = await fetch('/api/run-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');

      const columns = data.resultSetMetaData?.rowType.map((col: any) => col.name) || [];
      const formatted = data.data.map((row: any[]) =>
        columns.map((col: string, i: number) => `${col}: ${parseCell(row[i])}`).join('\n')
      );

      setMessages(prev => [...prev, { role: 'assistant', text: formatted.join('\n\n') }]);
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setSql('');
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow-lg p-6 space-y-4">
        <h1 className="text-3xl font-bold text-blue-800">💬 Snowflake Chat Interface</h1>

        <div className="h-[500px] overflow-y-auto bg-white border border-gray-300 rounded-md p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="flex gap-2 max-w-[85%]">
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center font-bold text-xs">A</div>
                )}
                <div
                  className={`p-3 rounded-xl text-sm shadow-sm whitespace-pre-wrap font-mono ${
                    msg.role === 'user'
                      ? 'bg-blue-100 text-blue-900 rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <code className="block text-sm whitespace-pre-wrap">{msg.text}</code>
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap leading-snug">{msg.text}</pre>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs">U</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[85%]">
                <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center font-bold text-xs">A</div>
                <div className="bg-gray-100 text-gray-800 text-sm p-3 rounded-xl rounded-bl-none shadow-sm animate-pulse">
                  Running query...
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex items-center space-x-2">
          <textarea
            className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm resize-none focus:ring focus:ring-blue-200"
            rows={2}
            placeholder="Enter SQL query..."
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
          <button
            onClick={runQuery}
            disabled={loading || !sql.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}
