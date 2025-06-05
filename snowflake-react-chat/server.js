const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // allow all origins for quick test
app.use(express.json());

// Test endpoint
app.post('/api/snowflake', (req, res) => {
  console.log('Received:', req.body);
  // Fake "Snowflake" response
  res.json({
    message: `You sent: "${req.body.statement || '[no statement]'}"`,
    code: "000000"
  });
});

// Optional: Root endpoint
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
