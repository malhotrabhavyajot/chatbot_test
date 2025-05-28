const fetch = require('node-fetch'); // npm install node-fetch@2

async function sendToSnowflakeAPI(message) {
    const snowflakeUrl = "https://WUQZVQT-DKC22677.snowflakecomputing.com/api/v2/statements";
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJXVVFaVlFULURLQzIyNjc3Lk1BTEhPVFJBQkhBVllBSk9ULlNIQTI1NjpsSk1mRjB3OFd5ZXY2SGRGR2oxbUkxM1F1b0VtQm1CYlZ4Vk5sa2ozM1gwPSIsInN1YiI6IldVUVpWUVQtREtDMjI2NzcuTUFMSE9UUkFCSEFWWUFKT1QiLCJleHAiOjE3NDg0MTg3NTUsImlhdCI6MTc0ODQxNTE1NX0.FWfQ5CzmTJK37Ih1hye-KDEMe9q9_OASWqOLA9kSg-gtgCyFt9jItRuRFfYeXysZ23NfDps8r9Ph5aVqGnJLE4JdmdVQ8PRAifGNGSSaTXmMJbWN5fVJ81UXdSR6lzShoWPepL_sfpVBkqFDL1takqMgMKkMeo9Y_Opr0RO1e8y_bEHymzDlh9tRzmuDUapDGCFLU54Qv8T0kajm6nZVOx_TTLtOW-dJnBcR0YQcWff5jnFagRFh10eM4NgVYvqIAk-vDdr7mQqZbEE6_PSByNe4K5aJfki-dBUIAaCPvYx3mpa1fUb_So6czOgfUbSikDwKD-gNGeJNL5lf_TUpzw";

    async function callSnowflake(usingToken) {
        const response = await fetch(snowflakeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${usingToken}`,
            },
            body: JSON.stringify({
                "statement": message,
                "role": "ACCOUNTADMIN",
                "warehouse": "INSURANCEWAREHOUSE",
                "database": "INSURANCEDB",
                "schema": "DATA"
            })
        });
        return response;
    }

    try {
        let response = await callSnowflake(token);
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Status: ${response.status}\n${errText}`);
        }
        const result = await response.text();
        console.log("Raw result from Snowflake:", result);
        return result;
    } catch (error) {
        console.error("Error:", error.message);
        return null;
    }
}

// Call the function for a basic test:
sendToSnowflakeAPI("SELECT DISTINCT CLAIM_TYPE FROM CLAIMS LIMIT 1;").then(result => {
    console.log("\n=== FINAL RESULT ===\n", result);
});
