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
      src="https://app.powerbi.com/reportEmbed?reportId=1934d315-44a7-4e53-8a47-59f2516116ab&autoAuth=true&ctid=ec3c7dee-d552-494b-a393-7f941a90b985"
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

