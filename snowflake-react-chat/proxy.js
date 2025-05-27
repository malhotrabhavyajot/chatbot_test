const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const SNOWFLAKE_URL = 'https://otsuka_ctdev.us-east-1.snowflakecomputing.com/api/v2/statements'; // Use your account URL
const SNOWFLAKE_JWT = 'eyJraWQiOiIyMDA5MzAzODE0OTU5NTI1OCIsImFsZyI6IkVTMjU2In0.eyJwIjoiMjAwOTMwMzgxMzAwNjY1ODY6MTE5NzYzODQwNCIsImlzcyI6IlNGOjEwMTUiLCJleHAiOjE3NTU2MjIyNjl9.H2wgPJhAfQKLIGXElSPy3zXKHOy2-ntg8Ww7cKsBjvq76fnPdOh8vt-V4703L43FVmnbfFt6xkPhSmWHJ7kk6w'; // Use your full key

app.post('/api/snowflake', async (req, res) => {
  try {
    const { statement } = req.body;
    const sfRes = await fetch(SNOWFLAKE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SNOWFLAKE_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        statement: `CALL CUSTOM_AGENT('${statement}')`,
        role: 'MSTR_READER_ROLE',
        warehouse: 'MSTR_M_WH',
        database: 'CDR',
        schema: 'CDR_RPT'
      })
    });
    const data = await sfRes.text();
    res.status(sfRes.status).send(data);
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

app.listen(4000, () => console.log('Proxy running on http://localhost:4000'));
