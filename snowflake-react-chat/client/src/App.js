import React from 'react';
import ChatBot from './components/ChatBot';

function App() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        position: "relative",
        margin: 0,
        padding: 0,
      }}
    >
      {/* Power BI Report filling full screen */}
      <iframe
      title="Power BI Report"
      // src = "https://app.powerbi.com/reportEmbed?reportId=f1470446-6df8-4e57-80ef-a9ebfc1c19cf&autoAuth=true&ctid=ec3c7dee-d552-494b-a393-7f941a90b985"
      src="https://app.powerbi.com/reportEmbed?reportId=9618f242-9df5-4505-9883-b7e1955dfef3&autoAuth=true&ctid=ec3c7dee-d552-494b-a393-7f941a90b985"
      frameBorder="0"
      allowFullScreen
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        }}
      ></iframe>
      {/* Floating ChatBot overlay */}
      <ChatBot />
    </div>
  );
}
export default App;

