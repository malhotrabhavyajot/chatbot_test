import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { KJUR } from 'jsrsasign';

const {
  SNOWFLAKE_ACCOUNT,
  SNOWFLAKE_USER,
  SNOWFLAKE_ROLE,
  SNOWFLAKE_WAREHOUSE,
  SNOWFLAKE_DATABASE,
  SNOWFLAKE_SCHEMA,
  SNOWFLAKE_PRIVATE_KEY,
  FINGERPRINT
} = process.env;

function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `${SNOWFLAKE_ACCOUNT}.${SNOWFLAKE_USER}.SHA256:${FINGERPRINT}`,
    sub: `${SNOWFLAKE_ACCOUNT}.${SNOWFLAKE_USER}`,
    iat: now,
    exp: now + 3600
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  return KJUR.jws.JWS.sign(
    'RS256',
    JSON.stringify(header),
    JSON.stringify(payload),
    SNOWFLAKE_PRIVATE_KEY!.replace(/\\n/g, '\n')
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid SQL statement.' });
  }

  try {
    const token = generateJWT();
    const accountUrl = SNOWFLAKE_ACCOUNT!.toLowerCase().replace(/_/g, '-');
    const apiUrl = `https://${accountUrl}.snowflakecomputing.com/api/v2/statements`;

    const response = await axios.post(apiUrl, {
      statement: sql.trim(),
      timeout: 60,
      database: SNOWFLAKE_DATABASE,
      schema: SNOWFLAKE_SCHEMA,
      warehouse: SNOWFLAKE_WAREHOUSE,
      role: SNOWFLAKE_ROLE
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('❌ Snowflake SQL API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Snowflake SQL query failed',
      details: error.response?.data || error.message
    });
  }
}
