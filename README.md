# Snowflake React Chat Setup

This project contains a React frontend and an Express backend located in the `snowflake-react-chat` directory.

## Prerequisites

- **Node.js** 16 or later
- **Snowflake credentials** for your account, user, role, warehouse, database and schema
- A **private key** and passphrase for Snowflake authentication
- An **OpenAI API key**

## Environment Variables

Create a `.env` file inside `snowflake-react-chat` with the following keys:

```bash
SNOWFLAKE_ACCOUNT=<your-snowflake-account>
SNOWFLAKE_USER=<your-snowflake-user>
SNOWFLAKE_URL=<your-snowflake-url>
SNOWFLAKE_ROLE=<role>
SNOWFLAKE_WAREHOUSE=<warehouse>
SNOWFLAKE_DATABASE=<database>
SNOWFLAKE_SCHEMA=<schema>
PRIVATE_KEY_PATH=<path-to-private-key>
PRIVATE_KEY_PASSPHRASE=<passphrase>
OPENAI_API_KEY=<your-openai-api-key>
```

## Development

1. Navigate into the project directory:
   ```bash
   cd snowflake-react-chat
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the backend server:
   ```bash
   node server.js
   ```
4. In another terminal, start the React development server:
   ```bash
   npm start
   ```
   This serves the app at `http://localhost:3000` and proxies API requests to the backend running on port `4000`.

## Production Build

To build the React application for production, run:

```bash
npm run build
```

The optimized files are placed in the `build/` directory. Serve this folder with your preferred static file server and ensure the backend (`node server.js`) is running to handle API calls.

## Git Ignore

Certain paths are excluded from version control via `.gitignore`:

- `node_modules/` contains external dependencies and can be reinstalled at any time.
- `build/` holds compiled production files.
- `.env` stores local environment variables such as API keys.
- `*.log` matches log output that is not needed in Git.

Ignoring these keeps the repository smaller and prevents leaking sensitive information.
