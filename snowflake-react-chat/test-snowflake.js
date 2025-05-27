const fetch = require('node-fetch'); // npm install node-fetch@2

async function sendToSnowflakeAPI(message) {
    const snowflakeUrl = "https://WUQZVQT-DKC22677.snowflakecomputing.com/api/v2/statements";
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJXVVFaVlFULURLQzIyNjc3Lk1BTEhPVFJBQkhBVllBSk9ULlNIQTI1NjpsSk1mRjB3OFd5ZXY2SGRGR2oxbUkxM1F1b0VtQm1CYlZ4Vk5sa2ozM1gwPSIsInN1YiI6IldVUVpWUVQtREtDMjI2NzcuTUFMSE9UUkFCSEFWWUFKT1QiLCJleHAiOjE3NDgzNjk1NTMsImlhdCI6MTc0ODM2NTk1M30.pyTyYW2uzy2DjwGkijXZ20j0tVbGZ2iUocyHnReFKNPzWb5zADtgc7mUFdajGyCgs6Kcel3oqjCjnTW59w0y3KYPq_2fmiNmqd3nf3nkKJg8DCoRuSvpmHq9b2f720dnBwmzMNcJwd00zDlsVyUeeS3EpCV6j2wH85by9Wr16r-07LMmPkcwqGuIWU87kRfjalIteWcr07XErvz-BCHM7QQYUkaoNbu5OHGq1OJI0le-QOTx0V5_p2xec6dyJqRbhUWPujrunbdm32qXE3HPwT7wXuhgCwubw6IDQV0By0bqyIVToGb4Pvw4L5wLYShsayCjgDau-AdEtKS4_Owt1g";

    async function callSnowflake(usingToken) {
        const response = await fetch(snowflakeUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${usingToken}`,
            },
            body: JSON.stringify({
                "statement": "SELECT top 1* from claims",
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
sendToSnowflakeAPI("SELECT CURRENT_TIMESTAMP;").then(result => {
    console.log("\n=== FINAL RESULT ===\n", result);
});
