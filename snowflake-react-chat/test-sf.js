const fetch = require('node-fetch'); // npm install node-fetch@2

async function sendToSnowflakeAPI(message) {
    const snowflakeUrl = "https://OTSUKAUS-SUA70364.snowflakecomputing.com/api/v2/statements";
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJPVFNVS0FVUy1TVUE3MDM2NC5DRFJfSU5HRVNUSU9OX0VUTF9VU0VSLlNIQTI1NjpsSk1mRjB3OFd5ZXY2SGRGR2oxbUkxM1F1b0VtQm1CYlZ4Vk5sa2ozM1gwPSIsInN1YiI6Ik9UU1VLQVVTLVNVQTcwMzY0LkNEUl9JTkdFU1RJT05fRVRMX1VTRVIiLCJleHAiOjE3NDg0MTczMjAsImlhdCI6MTc0ODQxMzcyMH0.KrBbgxQvbHsYUHPbqh0sXe8U-ilxMu_6IJ_-DLbysbvg7wAxC3UihNSwmobsKzt3uSt9oSOr4noAtVyhfdpJsk4_qlu1D2-VjPtl8yAayRkRcwbIMJC1rxN9Ms2z8y1xVjQL4pJ0p9EGKc__f7f9x3eG2sl-uVv0W4ghcKqjPln9tf9eD7ry8QiIdHSNr409jzPnwri3ZcDG689Wmgku689nJEQQmgTrFnBMMTRUSvOpyk0DDnWC9dx4vlY1LjFf7bm96XRoVUKITWlDjjiSq8kb_oiWFHc6C3F_M3zCmpqJd_TVrwVBHTkdsW6Se_pAy9NizvgQTQfoHDnJ9dhwXA";

    async function callSnowflake(usingToken) {
        const response = await fetch(snowflakeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${usingToken}`,
            },
            body: JSON.stringify({
                "statement": "SELECT top 1* from FREE_GOOD_ABM",
                "role": "CDR_ETL_DEV_ROLE",
                "warehouse": "CDR_ETL_DEV_ROLE",
                "database": "CDR",
                "schema": "ABM_FREE_GOOD"
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
sendToSnowflakeAPI("SELECT CURRENT_TIMESTAMP;").then(result => {
    console.log("\n=== FINAL RESULT ===\n", result);
});
