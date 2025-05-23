
var prefix = window.location.pathname.substr(0, window.location.pathname.toLowerCase().lastIndexOf("/extensions") + 1);
var config = {
    host: window.location.hostname,
    prefix: prefix,
    port: window.location.port,
    isSecure: window.location.protocol === "https:"
};

const saveChatToLocalStorage = (chatHistory) => {
    localStorage.setItem("chatbot-history", JSON.stringify(chatHistory));
};

const getChatFromLocalStorage = () => {
    const stored = localStorage.getItem("chatbot-history");
    return stored ? JSON.parse(stored) : [];
};

const appendToChatHistory = (role, message) => {
    const history = getChatFromLocalStorage();
    history.push({ role, message });
    saveChatToLocalStorage(history);
};


define(["qlik", "text!./Mark11.html"], function (qlik, html) {
    return {
        support: {
            snapshot: true,
            export: true,
            exportData: false
        },
        paint: function () {
            const chatbotId = "chatBox";

            if (!document.getElementById(chatbotId)) {
                // Inject chatbot HTML globally
                const wrapper = document.createElement("div");
                wrapper.innerHTML = html;
                document.body.appendChild(wrapper);

                setTimeout(() => {
                    const app = qlik.currApp(this);

                    window.navigateToSheet = function (sheetId) {
                        if (sheetId) {
                            // Set chatbot active flag
                            localStorage.setItem("show-chatbot", "true");
                            // Navigate to target sheet
                            const currentUrl = window.location.href;
                            const newUrl = currentUrl.replace(/sheet\/[0-9a-f-]+/, `sheet/${sheetId}`);
                            window.location.href = newUrl;
                        }
                    };


                    // Greet user
                    qlik.getGlobal().getAuthenticatedUser().then(res => {
						//console.log("Authenticated User Info:", res);
                        const rawUser = res.qReturn || "User";
						const userMatch = rawUser.match(/UserId=(.+)/);
						const username = userMatch ? userMatch[1] : rawUser.split("\\").pop().split("@")[0];
						const hour = new Date().getHours();
						const greetingText = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

						const userMap = {
							"xspw": "Shruti",
							"pvji": "Prithviraj",
							"xmdb": "Madhuresh",
							"qlmm": "Abdulla",
							"qvtl": "Shrey",
							"ubtw": "Shobhita",
							"ugsi": "Anurag",
							"dhmp": "Darshana",
							"yurh": "Murali",
							"skbt": "Shankha",
							"lzrv": "Lazar"
							// Add more userId: "Full Name" pairs here qlmm,xmdb,pvji,ubtw,ugsi-anuraj singh,dhmp - darshana malpani,yurh-murali satyamurthy,skbt-shankha bhattacharya,lzrv - lazar vellare
						};

						// Check if userId exists in map, otherwise fallback to userId
						const displayName = userMap[username.toLowerCase()] ? `${userMap[username.toLowerCase()]}` : username;

						const chatBox = document.querySelector(".chatbox");
						if (!chatBox) return;

						const history = getChatFromLocalStorage();
						history.forEach(entry => {
							if (entry.role === "user") {
								const chatLi = createChatLi(entry.message, "outgoing");
								chatBox.appendChild(chatLi);
							}

							if (entry.role === "assistant") {
								const chatLi = createChatLi("", "incoming");

								if (entry.message.includes("navigateToSheet")) {
									chatLi.querySelector("p").outerHTML = "";
									chatLi.innerHTML = entry.message;
								} else {
									const messageHTML = entry.message
										.replace(/\n/g, "<br>")
										.replace(/\b\d+(\.\d+)?%?\b/g, match => `<b>${match}</b>`);
									chatLi.querySelector("p").innerHTML = messageHTML;
								}

								chatBox.appendChild(chatLi);
							}
						});
						scrollChatToBottom();


						if (chatBox && chatBox.childElementCount <= 1) {
							const greet = `${greetingText} ${displayName} 👋 ! How may I assist you?`;
							const incomingChatLi = createChatLi(greet, "incoming");
							chatBox.appendChild(incomingChatLi);
							appendToChatHistory("assistant", greet);
							chatBox.scrollTo(0, chatBox.scrollHeight);
						}

                    });

                    // Fetch selections
                    app.getList("SelectionObject", function (reply) {
                        let filters = [];
                        if (reply.qSelectionObject.qSelections.length > 0) {
                            reply.qSelectionObject.qSelections.forEach(sel => {
                                const field = sel.qField;
                                const values = sel.qSelectedFieldSelectionInfo.map(v => v.qName).join(", ");
                                filters.push(`${field}: ${values}`);
                            });
                        } else {
                            filters.push("No filters selected");
                        }
                        window.currentQlikFilters = filters.join(" | ");
                    });

                    // Fetch token
                    const TokenApp = qlik.openApp('cb8a87b1-fc75-4793-b122-dd78651cda7a', config);
                    function fetchToken() {
                        TokenApp.variable.getContent({ qName: 'vTOKEN' }, function (reply) {
                            window.myQlikToken = reply.qContent.qString;
                        });
                    }
                    fetchToken();
                    setInterval(fetchToken, 2 * 60 * 1000);
                }, 1000);

                const chatbotToggler = document.querySelector(".chatbot-toggler");
                const closeBtn = document.querySelector(".close-btn");
                const chatbot = document.querySelector(".chatbot");
                const chatInput = document.querySelector(".chat-input textarea");
                const sendChatBtn = document.querySelector(".chat-input span");
                const enlargeChat = document.getElementById("enlargeChat");
                const chatBox = document.getElementById("chatBox");

                let isExpanded = false;
                let userMessage = null;
                let questionWithContext = null;
                const inputInitHeight = chatInput.scrollHeight;

                let isDragging = false;
                let offsetX, offsetY;

                let token = null;

                // Fetch fallback JWT token from Render
                async function fetchTokenFromRender() {
                    try {
                        const res = await fetch("https://project-f3vi.onrender.com/generate_jwt");
                        const data = await res.json();
                        return data.token;
                    } catch (error) {
                        console.error("Failed to fetch token from Render:", error);
                        return null;
                    }
                }

                // Try calling Snowflake, fallback if auth fails
                async function sendToSnowflakeAPI(message) {
                    const snowflakeUrl = "https://novonordisk-nni.snowflakecomputing.com";
                    // Always try Qlik token first
                    //token = `eyJraWQiOiIxMzgwNTQ4MDg4OTAwODIwNiIsInR5cCI6IkpXVCIsImFsZyI6IkhTMjU2In0.eyJzdWIiOiIyMTA2NTQ5MzE4MDUiLCJzY3AiOjEzODA1NDgwODg0MTY5MTIyLCJpc3MiOiJodHRwczovL05OSV9TQU5EQk9YLnVzLWVhc3QtMS5wcml2YXRlbGluay5zbm93Zmxha2Vjb21wdXRpbmcuY29tIiwidHlwZSI6Ik9BVCIsImF1ZCI6ImpxYW1hbWltLW5vdm9ub3JkaXNrLW5uaXNhbmRib3guc25vd2ZsYWtlY29tcHV0aW5nLmFwcCIsImFjY291bnRJZCI6MzIxNDMzOSwibmJmIjoxNzQ0Nzk5MTgxLCJhdXRobklkIjoiNTo4MjI4NzA3ODhfYTE3MzQ5OWItOTY1Ny00NTlmLTk2ODktNGYxZmIyNzVmMjAyIiwiYXV0aG5FdmVudElkIjoxMzgwNTQ4MDg5MDQ5OTA3NCwiZXhwIjoxNzQ0ODAyNzgxLCJpYXQiOjE3NDQ3OTkxODEsImp0aSI6ImE1ODU0YjRmLTVmNmQtNDcxYy1iZWU0LTQ1NjYzODdlZTEyYiJ9.TQ-8d7dANtP8Es-kz48Op7OwbQyLhVcq9YDzclIKnHQ`;
                    token = window.myQlikToken;
                    console.log("Qlik Token:", token);
                    async function callSnowflake(usingToken) {
                        const response = await fetch(`${snowflakeUrl}/api/v2/statements`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${usingToken}`,
                            },
                            body: JSON.stringify({
                                "statement": `CALL AGENT_GATEWAY('${message}');`,
                                "role": "NNI_SNFK_APP_CONNEX_ADMIN_CDW_NPROD",
                                "warehouse": "WH_XS_APP_CONNEX_CDW_NPROD",
                                "database": "CDW_DEV",
                                "schema": "APP_CONNEX"
                            })
                        });
                        return response;
                    }

                    try {
                        let response = await callSnowflake(token);

                        // If token is expired or unauthorized
                        if (response.status === 401 || response.status === 403) {
                            console.log(response);
                            console.warn("Token likely expired or unauthorized. Retrying with Render token...");
                            token = await fetchTokenFromRender();

                            if (!token) return "Error: Unable to refresh token.";

                            response = await callSnowflake(token); // Retry with new token
                        }

                        const rawText = await response.text();
                        let rawTextJson = JSON.parse(rawText);
                        const lines = rawText.split("\n");
                        console.log(rawText);
                        let extractedTexts = [];

                        lines.forEach(line => {
                            if (line.startsWith('  "data" : [ [')) {
                                try {
                                    const rawLine_1 = line.replace('  "data" : ', "").trim();
                                    const rawLine_2 = rawLine_1.replace('[ [', '[[').replaceAll("'", "");
                                    const rawLine_3 = rawLine_2.replace('] ],', ']]');
                                    const dataArray = JSON.parse(rawLine_3);
                                    const innerString = dataArray[0][0];
                                    const fixedJsonString = innerString
                                        .replace(/'/g, '"')
                                        .replace(/None/g, 'null')
                                        .replace(/\bTrue\b/g, 'true')
                                        .replace(/\bFalse\b/g, 'false');
                                    const parsedObject = JSON.parse(fixedJsonString);
                                    extractedTexts.push(parsedObject.output);
                                } catch (error) {
                                    console.log("Error parsing JSON: ", error);
                                }
                            }
                        });
                        let temp = extractedTexts.join(" ") || "Sorry, I couldn't process your request."
                        if (temp === "Sorry, I couldn't process your request.") {

                            console.log('Get Request');

                            let statementHandle = rawTextJson.statementHandle;
                            let message = rawTextJson.message;

                            async function call_statement_handle(usingToken) {
                                const statement_handle = await fetch(`${snowflakeUrl}/api/v2/statements/${statementHandle}`, {
                                    method: "GET",
                                    headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${usingToken}`,
                                    }
                                });
                                return statement_handle;
                            }

                            while (message === "Asynchronous execution in progress. Use provided query id to perform query monitoring and management.") {
                                let new_response = await call_statement_handle(token);
                                try {

                                    let new_response_rawText = await new_response.text();

                                    // console.log('Get request response', new_response_rawText);
                                    if (new_response.status === 401 || new_response.status === 403) {
                                        console.log(new_response);
                                        console.warn("Token likely expired or unauthorized. Retrying with Render token...");
                                        token = await fetchTokenFromRender();
                                        if (!token) return "Error: Unable to refresh token.";
                                        new_response = await call_statement_handle(token);
                                        new_response_rawText = await new_response.text();
                                    }

                                    //let new_response_rawText = await new_response.text();
                                    //console.log('Post request response', new_response_rawText);
                                    let new_rawTextJson = JSON.parse(new_response_rawText);
                                    message = new_rawTextJson.message;
                                    let new_lines = new_response_rawText.split("\n");
                                    new_lines.forEach(new_line => {
                                        if (new_line.startsWith('  "data" : [ [')) {
                                            try {
                                                const new_rawLine_1 = new_line.replace('  "data" : ', "").trim();
                                                const new_rawLine_2 = new_rawLine_1.replace('[ [', '[[').replaceAll("'", "");
                                                const new_rawLine_3 = new_rawLine_2.replace('] ],', ']]');
                                                const new_dataArray = JSON.parse(new_rawLine_3);
                                                const new_innerString = new_dataArray[0][0];
                                                const new_fixedJsonString = new_innerString
                                                    .replace(/'/g, '"')
                                                    .replace(/None/g, 'null')
                                                    .replace(/\bTrue\b/g, 'true')
                                                    .replace(/\bFalse\b/g, 'false');
                                                const new_parsedObject = JSON.parse(new_fixedJsonString);
                                                extractedTexts.push(new_parsedObject.output);

                                            } catch (error) {
                                                console.log("Error parsing JSON: ", error);
                                            }
                                        }
                                    });

                                } catch (error) {
                                    console.log(error);
                                    return "Sorry, I couldn't process your request.";

                                }

                            }
                            console.log('Get request response', extractedTexts.join(" "));

                            return extractedTexts.join(" ") || "Sorry, I couldn't process your request.";
                        }
                        else {
                            return extractedTexts.join(" ") || "Sorry, I couldn't process your request.";
                        }

                    } catch (error) {
                        console.error("Unexpected error:", error);
                        return "Unexpected error calling Snowflake.";
                    }
                }

                document.getElementById("clearChat").addEventListener("click", () => {
                    if (confirm("Are you sure you want to clear the chat history?")) {
                        // Clear local storage
                        localStorage.removeItem("chatbot-history");

                        // Clear chat window
                        const chatbox = document.querySelector(".chatbox");
                        if (chatbox) chatbox.innerHTML = "";

                        // Re-add the greeting
                        qlik.getGlobal().getAuthenticatedUser().then(res => {
                            const rawUser = res.qReturn || "User";
                            const userMatch = rawUser.match(/UserId=(.+)/);
                            const username = userMatch ? userMatch[1] : rawUser.split("\\").pop().split("@")[0];
                            const hour = new Date().getHours();
                            const greetingText = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

							const userMap = {
								"xspw": "Shruti",
								"pvji": "Prithviraj",
								"xmdb": "Madhuresh",
								"qlmm": "Abdulla",
								"qvtl": "Shrey",
								"ubtw": "Shobhita",
								"ugsi": "Anurag",
								"dhmp": "Darshana",
								"yurh": "Murali",
								"skbt": "Shankha",
								"lzrv": "Lazar"
							};

							const displayName = userMap[username.toLowerCase()] ? `${userMap[username.toLowerCase()]}` : username;

                            const chatBox = document.querySelector(".chatbox");
                            if (!chatBox) return;

                            const greet = `${greetingText} ${displayName} 👋 ! How may I assist you?`;
                            const incomingChatLi = createChatLi(greet, "incoming");
                            chatBox.appendChild(incomingChatLi);
                            appendToChatHistory("assistant", greet);
                            scrollChatToBottom();
                        });

                    }
                });
                const dragStart = (e) => {
                    if (e.target.closest(".chat-input")) return;
                    isDragging = true;
                    offsetX = e.clientX - chatbot.getBoundingClientRect().left;
                    offsetY = e.clientY - chatbot.getBoundingClientRect().top;
                    holder.style.cursor = "grabbing";
                };

                const dragMove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    const chatbotRect = chatbot.getBoundingClientRect();

                    let left = e.clientX - offsetX;
                    let top = e.clientY - offsetY;

                    left = Math.max(0, Math.min(windowWidth - chatbotRect.width, left));
                    top = Math.max(0, Math.min(windowHeight - chatbotRect.height, top));

                    chatbot.style.left = `${left}px`;
                    chatbot.style.top = `${top}px`;
                    chatbot.style.right = "auto";
                    chatbot.style.bottom = "auto";
                };

                const dragEnd = () => {
                    isDragging = false;
                    holder.style.cursor = "grab";
                };

                const resizeHandle = document.getElementById("resizeHandle");

                resizeHandle.addEventListener("mousedown", (e) => {
                    e.preventDefault();

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = parseInt(document.defaultView.getComputedStyle(chatbot).width, 10);
                    const startHeight = parseInt(document.defaultView.getComputedStyle(chatbot).height, 10);

                    function doDrag(e) {
                        const newWidth = Math.max(420, startWidth + e.clientX - startX);
                        const newHeight = Math.max(550, startHeight + e.clientY - startY);
                        chatbot.style.width = newWidth + "px";
                        chatbot.style.height = newHeight + "px";
                    }

                    function stopDrag() {
                        document.documentElement.removeEventListener("mousemove", doDrag);
                        document.documentElement.removeEventListener("mouseup", stopDrag);
                    }

                    document.documentElement.addEventListener("mousemove", doDrag);
                    document.documentElement.addEventListener("mouseup", stopDrag);
                });

                const scrollChatToBottom = () => {
                    const chatbox = document.querySelector(".chatbox");
                    setTimeout(() => {
                        chatbox.scrollTop = chatbox.scrollHeight;
                    }, 100); // ensures DOM has rendered message
                }

                document.querySelectorAll('.suggestions div').forEach(item => {
                    item.addEventListener('click', () => {
                        const suggestion = item.getAttribute('data-suggestion');
                        sendSuggestion(suggestion);
                    });
                });



                function extractRelevantFilters(filterString) {
                    const relevantKeys = ["Territory Type Group", "Market", "POD"];
                    const parsedFilters = [];

                    // Split filters and match relevant ones
                    filterString.split(" | ").forEach(pair => {
                        const [key, value] = pair.split(":").map(s => s.trim());
                        if (!key || !value) return;

                        // Check for direct key match or known aliases
                        if (
                            key === "Territory Type Group" ||
                            key === "Market" ||
                            key === "POD"
                        ) {
                            parsedFilters.push(`| ${key}: ${value}`);
                        }
                    });
                    return parsedFilters;
                }



                const createChatLi = (message, className) => {
                    const chatLi = document.createElement("li");
                    chatLi.classList.add("chat", className);

                    if (className === "outgoing") {
                        chatLi.innerHTML = `<p>${message}</p>`;
                    } else {
                        chatLi.innerHTML = `
							<div>
							<div class="botResponse">
								<span class="material-symbols-outlined">trip_origin</span>
								<p>${message}</p>
							</div>
							<div class="feedback">
							<button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
							<button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
							</div>
							</div>`;
                    }
                    return chatLi;
                };

                const generateResponse = async (chatElement, questionWithContext) => {
                    const messageElement = chatElement.querySelector("p");

                    console.log("Setting up status wrapper...");
                    messageElement.innerHTML = `
						<div class="status-wrapper">
							<div class="spinner"></div>
							<div class="status-text" id="statusText"></div>
						</div>
					`;
                    messageElement.style.display = "flex";

                    const statusText = messageElement.querySelector("#statusText");
                    //const messages = ["Thinking", "Processing", "Executing"];
                    const messages = ["Analyzing . . . "];
                    let current = 0;
                    let stopStatus = false;

                    console.log("Starting API request...");
                    const responsePromise = sendToSnowflakeAPI(questionWithContext);

                    const loopStatusMessages = async () => {
                        console.log("Started looping status messages...");
                        while (!stopStatus) {
                            const text = messages[current % messages.length];
                            console.log("Displaying status message:", text);
                            await typeWriter(text);
                            current++;
                        }
                        console.log("Stopped looping status messages.");
                    };

                    const typeWriter = (text) => {
                        return new Promise((resolve) => {
                            statusText.textContent = "";
                            let i = 0;
                            const interval = setInterval(() => {
                                statusText.textContent += text.charAt(i);
                                i++;
                                if (i >= text.length) {
                                    clearInterval(interval);
                                    setTimeout(() => {
                                        resolve();
                                    }, 10000); // short pause before next status message
                                }
                            }, 100);
                        });
                    };

                    // Start looping the status messages
                    //loopStatusMessages();
                    statusText.textContent = "Analyzing . . .";
                    await new Promise(resolve => setTimeout(resolve, 7000));
                    statusText.textContent = "Generating Response . . .";
                    try {
                        const responseText = await responsePromise;
                        console.log("API response received.");
                        stopStatus = true;

                        // Show "Formatting your response..." briefly
                        statusText.textContent = " ";
                        statusText.textContent = "Formatting your response . . .";
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        console.log("Showing 'Formatting your response' message");

                        //setTimeout(() => {
                        console.log("Rendering final response...");
                        messageElement.style.display = "block";
                        messageElement.innerHTML = ""; // clear status UI

                        let fullBotResponse = "";
                        let index = 0;

                        const typingInterval = setInterval(() => {
                            if (index < responseText.length) {
                                const char = responseText.charAt(index);
                                messageElement.innerHTML += char
                                    .replace(/&/g, "&amp;")
                                    .replace(/</g, "&lt;")
                                    .replace(/>/g, "&gt;")
                                    .replace(/\n/g, "<br>")
                                    .replace(/\u2022/g, "&bull;");
                                fullBotResponse += char;
                                index++;
                                scrollChatToBottom();
                            } else {
                                clearInterval(typingInterval);
                                console.log("Completed typing bot response.");

                                // Bold numbers
                                const numberRegex = /\b\d+(\.\d+)?%?\b/g;
                                messageElement.innerHTML = messageElement.innerHTML.replace(
                                    numberRegex,
                                    (match) => `<b>${match}</b>`
                                );

                                appendToChatHistory("assistant", fullBotResponse);

                                const feedbackDiv = chatElement.querySelector(".feedback");
                                if (feedbackDiv) {
                                    feedbackDiv.style.opacity = "1";
                                    feedbackDiv.style.transition = "opacity 0.5s ease";
                                    feedbackDiv.style.animation = "fadeIn 1s ease forwards";
                                }

                                scrollChatToBottom();
                            }
                        }, 20);
                        //}, 800);

                    } catch (error) {
                        console.log("API error:", error);
                        stopStatus = true;
                        messageElement.classList.add("error");
                        messageElement.textContent = "Error fetching response.";
                        scrollChatToBottom();
                    }
                };

                const handleChat = async () => {
                    const userMessage = chatInput.value.trim();
                    if (!userMessage) return;

                    chatInput.value = "";
                    chatInput.style.height = `${inputInitHeight}px`;

                    const chatbox = chatBox.querySelector(".chatbox");

                    const outgoing = createChatLi(userMessage, "outgoing");
                    chatbox.appendChild(outgoing);
                    appendToChatHistory("user", userMessage);
                    scrollChatToBottom();

                    const greetingRegex = /\b(hi|hello|hey|yo|sup|howdy|good\s*(morning|afternoon|evening)|what's up|wassup|hola|namaste)\b/i;
					const pattern = /what do you know about me\??/i;
					const lowerUserMsg = userMessage.toLowerCase().replace(/[^\w\s]/g, "");

    let finalBotResponse = "";
    if (greetingRegex.test(lowerUserMsg)) {
        finalBotResponse = "Hello 👋! How may I assist you?";
    } else if (lowerUserMsg.includes("who am i") || lowerUserMsg.includes("what do you know about me")) {
        //finalBotResponse = "You are a Sales Representative for the MODERN NIAD market, covering the Brooklyn, NY territory under POD ID SADEANG0.";
		finalBotResponse = `Based on your profile, you are a Sales Representative responsible for the Brooklyn, NY region. \n I am here to help you with:\n     - Navigating sales data and performance metrics in your territory.\n     - Accessing and interpreting KPIs relevant to your role.\n     - Identifying trends or opportunities within your assigned region.\n Is there something specific you would like assistance with today?`;
    }else if (lowerUserMsg.includes("i am a new rep which kpis should i track")) {
		finalBotResponse = `As a new Novo Nordisk sales representative, you should focus on these key KPIs:
 
1. Total Rx / NRx / TRx Growth
Tracks the volume of prescriptions written by target HCPs.
	•NRx: New prescriptions
	•TRx: Total prescriptions
	This helps assess early demand generation and prescriber conversion.
	
2. Market Share %
Measures the share of Novo Nordisk products in your assigned territory relative to competitors.
	•Useful to understand positioning and identify areas of opportunity for growth.
	
3. CPC, CPE & Reach %
	•CPC (Call Plan Compliance) and CPE (Call Plan Execution) reflect adherence to the call plan.
	•Reach % shows the percentage of target HCPs contacted at least once within a POA (Plan of Action) cycle.
	These metrics ensure execution excellence and territory coverage from day one.
	
4. % to Goal (Quota Attainment)
	Tracks your progress against set sales targets.
	Helps you pace your activities and adjust efforts to meet or exceed objectives
 
These metrics will help you track your territory performance, ensure proper execution of your call plan, and measure your progress against sales targets.`
	}
	

    if (finalBotResponse) {
        const incomingChatLi = createChatLi("", "incoming");
        chatbox.appendChild(incomingChatLi);
        scrollChatToBottom();

        const messageElement = incomingChatLi.querySelector("p");
        messageElement.innerHTML = `
<div class="status-wrapper">
<div class="spinner"></div>
<div class="status-text" id="statusText"></div>
</div>
`;
        messageElement.style.display = "flex";

        const statusText = messageElement.querySelector("#statusText");

        // Status transitions
        statusText.textContent = "Analyzing . . .";
        await new Promise(resolve => setTimeout(resolve, 2500));
        statusText.textContent = "Generating Response . . .";
        await new Promise(resolve => setTimeout(resolve, 2000));
        statusText.textContent = "Formatting your response . . .";
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Stream typing response
        messageElement.style.display = "block";
        messageElement.innerHTML = "";
        let index = 0;

        const typingInterval = setInterval(() => {
            if (index < finalBotResponse.length) {
                messageElement.textContent += finalBotResponse.charAt(index);
                index++;
                scrollChatToBottom();
            } else {
                clearInterval(typingInterval);
                appendToChatHistory("assistant", finalBotResponse);
                scrollChatToBottom();
            }
        }, 20);

        return;
    }
                   

                    const incomingChatLi = createChatLi("Thinking...", "incoming");
                    chatbox.appendChild(incomingChatLi);
                    scrollChatToBottom();

                    //const cleanedMsg = userMessage.toLowerCase().trim();
					const cleanedMsg = userMessage
						  .toLowerCase()
						  .trim()
						  .replace(/[^\w\s]/g, ""); // removes punctuation like ? ! .

					// where can I find breadth and depth ---- replace with breadth and depth 
					// Where can I learn more about reach and frequency?   -- cpc
					// Where can I find Reach?  --- cpc
					// Can you take me sales TRx page? -- sales Trx page
                    const hardcodedResponses = {
                        "where can i find my cpc": `
    <div class="botResponse">
      <span class="material-symbols-outlined">trip_origin</span>
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <p>The <b>CPC </b> metric can be found in the sheet below</p>
        <button onclick="navigateToSheet('e0f6dfa4-56c1-46cc-b747-ace997947368')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View CPC Sheet
        </button>
      </div>
    </div>
    <div class="feedback">
      <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
      <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
    </div>
    `,
	"where can i learn more about reach and frequency": `
    <div class="botResponse">
      <span class="material-symbols-outlined">trip_origin</span>
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <p>The <b>reach and frequency</b> can be found in the sheet below</p>
        <button onclick="navigateToSheet('e0f6dfa4-56c1-46cc-b747-ace997947368')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View reach and frequency sheet
        </button>
      </div>
    </div>
    <div class="feedback">
      <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
      <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
    </div>
    `,
	"where can i find reach": `
    <div class="botResponse">
      <span class="material-symbols-outlined">trip_origin</span>
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <p>The <b>reach </b> can be found in the sheet below</p>
        <button onclick="navigateToSheet('e0f6dfa4-56c1-46cc-b747-ace997947368')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View reach sheet
        </button>
      </div>
    </div>
    <div class="feedback">
      <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
      <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
    </div>
    `,
	"can you take me to sales trx page": `
    <div class="botResponse">
      <span class="material-symbols-outlined">trip_origin</span>
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <p><b>TRx</b> sales can be found in the sheet below </p>
        <button onclick="navigateToSheet('94b13c3c-1b11-4568-82c0-3fbdc9718d90')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View TRx sheet
        </button>
      </div>
    </div>
    <div class="feedback">
      <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
      <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
    </div>
    `,

                        "which prescriber qualifies as a new writer": `
    <div class="botResponse">
      <span class="material-symbols-outlined">info</span>
	    <div style="display: flex; flex-direction: column; align-items: flex-start;">

      <p>A prescriber qualifies as a new writer if they have a script volume (including partial scripts) greater than 0, if they have written in the time frame based on your selections. In cases where the new writers have TRx within multiple payer channels, the payer channel with the highest TRx is displayed.<br>	•Exclusion flags are disabled in Customer -> New Writer tab </p>
        <button onclick="navigateToSheet('ecdc61fd-ea03-4274-8333-48ec23450281')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View New Writers
        </button>
		</div>
      </div>
      <div class="feedback">
        <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
        <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
      </div>
      `,

                        "what is breadth and depth": `
      <div class="botResponse">
        <span class="material-symbols-outlined">search</span>
		  <div style="display: flex; flex-direction: column; align-items: flex-start;">
	
        <p>Breadth refers to number of HCPs who wrote the product at least once for the time period measured. Breadth provides a gauge of Sales ability to influence prescribers.<br><br>Breadth is calculated  as : 
          - number of writer (Breadth) / total HCP in ICU (total dirt).<br><br>Depth is the average number of scripts written by call plan prescribers in the Month time period selected.<br>Depth is calculated  as : 
          - ∑ TRx for Writers / number of HCPs who wrote the Product in the time period measured (breadth count).</p>
        <button onclick="navigateToSheet('334416a1-c84f-49c3-afbf-0e518c067859')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View breadth and depth sheet
        </button>
      </div>
	  </div>
      <div class="feedback">
        <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
        <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
      </div>
      `,
	  "where can i find sales trend": `
    <div class="botResponse">
      <span class="material-symbols-outlined">trip_origin</span>
      <div style="display: flex; flex-direction: column; align-items: flex-start;">
        <p><b>Sales Trend</b> can be found in the sheet below </p>
        <button onclick="navigateToSheet('d482c245-3fb4-48ec-b50e-f49c6e956284')"
          style="margin-top: 10px; padding: 8px 16px; border: none; background-color: #007bff; color: white; border-radius: 6px; cursor: pointer;">
          🔍 View Sales Trend Sheet 
        </button>
      </div>
    </div>
    <div class="feedback">
      <button class="like-btn" onclick="handleFeedback(this, 'like')">👍</button>
      <button class="dislike-btn" onclick="handleFeedback(this, 'dislike')">👎</button>
    </div>
    `
	
                    };

                    const matchedKey = Object.keys(hardcodedResponses).find(key =>
                        cleanedMsg.includes(key)
                    );

                     if (matchedKey) {
                        const hardcodedHTML = hardcodedResponses[matchedKey];
						const messageElement = incomingChatLi.querySelector("p");
                        messageElement.innerHTML = `
                            <div class="status-wrapper">
                                <div class="spinner"></div>
                                <div class="status-text" id="statusText"></div>
                            </div>
                        `;
                        messageElement.style.display = "flex";

                        const statusText = messageElement.querySelector("#statusText");

                        // Step 2: Simulate analyzing and generation delays
						statusText.textContent = "Analyzing . . .";
						await new Promise(resolve => setTimeout(resolve, 4000));
						statusText.textContent = "Generating Response . . .";
						await new Promise(resolve => setTimeout(resolve, 7000));
						statusText.textContent = "Formatting your response . . .";
						await new Promise(resolve => setTimeout(resolve, 2000));

                        messageElement.style.display = "block";
                        messageElement.innerHTML = "";
                        incomingChatLi.innerHTML = hardcodedHTML;
                        appendToChatHistory("assistant", hardcodedHTML);
                        saveChatToLocalStorage(getChatFromLocalStorage());
                        return;
                    }




                    const filters = window.currentQlikFilters || "No filters applied";
                    const relevantFilters = extractRelevantFilters(filters);
                    //const questionWithContext = `You are a user that must follow the following filters: ${relevantFilters}. Use those if needed to answer the following question: ${userMessage}`;
                    const questionWithContext = `You are a Planner AI Agent responsible for intelligently routing the user query to the appropriate underlying agent—either for structured data (e.g., tabular metrics, KPIs) or unstructured data (e.g., documents, PDFs).
Follow these guidelines strictly. Deviation may result in incorrect routing:
 
- When invoking **Cortex Analyst** (used for tabular data or KPI-based queries):
  - If the user query matches one from the list of verified queries, always use the corresponding verified query.
  - Apply only the contextually relevant filters from the following list: ${relevantFilters}.
  - Do **not** apply filters unless they are logically and contextually required based on the user query.
  - Avoid using the **$** symbol with numeric values.
 
- When invoking **Cortex Search** (used for unstructured/document-based queries):
  - Do **not** apply filters.
  - Return only the precise information found in the provided context—no interpretations or extrapolations.
  - Provide a one-line definition (maximum two lines) and avoid unnecessary details.
  - Avoid explanations unless explicitly requested.
  - Do **not** include formulas or calculations unless explicitly requested.
  - If the user requests formulas or numerical expressions, extract and return only the precise details found in the context—no interpretations.
 
User question: ${userMessage}`
                    console.log("Question ", questionWithContext);
                    generateResponse(incomingChatLi, questionWithContext);
                };

/*- If the required information is not available in the provided context, respond with:
  - "This question requires additional context. I am continuing to learn and will follow up once I have the necessary details."
 
- **Formatting Requirements**:
  - Use a clear bullet-point format for your response.
  - Each bullet should be concise and on a new line.
  - Maintain a structured and professional tone for clarity and ease of understanding.
  - Avoid using symbols.*/
  
                const sendSuggestion = (text) => {
                    const userMessage = text.trim();
                    if (!userMessage) return;

                    chatInput.value = "";
                    chatInput.style.height = `${inputInitHeight}px`;

                    const chatbox = chatBox.querySelector(".chatbox");
                    const outgoing = createChatLi(userMessage, "outgoing");
                    appendToChatHistory("user", userMessage);
                    chatbox.appendChild(outgoing);
                    scrollChatToBottom();

                    const incomingChatLi = createChatLi("Thinking...", "incoming");
                    chatbox.appendChild(incomingChatLi);
                    scrollChatToBottom();

                    const filters = window.currentQlikFilters || "No filters applied";
                    const relevantFilters = extractRelevantFilters(filters);
                    //const questionWithContext = `You are a user that must follow the following filters: ${relevantFilters}. Use those if needed to answer the following question: ${userMessage}`;
                    //const questionWithContext = `${userMessage}`;
                    const questionWithContext = `You are a Planner AI Agent responsible for intelligently routing the user query to the appropriate underlying agent—either for structured data (e.g., tabular metrics, KPIs) or unstructured data (e.g., documents, PDFs).
Follow these guidelines strictly. Deviation may result in incorrect routing:
 
- When invoking **Cortex Analyst** (used for tabular data or KPI-based queries):
  - If the user query matches one from the list of verified queries, always use the corresponding verified query.
  - Apply only the contextually relevant filters from the following list: ${relevantFilters}.
  - Do **not** apply filters unless they are logically and contextually required based on the user query.
  - Avoid using the **$** symbol with numeric values.
 
- When invoking **Cortex Search** (used for unstructured/document-based queries):
  - Do **not** apply filters.
  - Return only the precise information found in the provided context—no interpretations or extrapolations.
  - Provide a one-line definition (maximum two lines) and avoid unnecessary details.
  - Avoid explanations unless explicitly requested.
  - Do **not** include formulas or calculations unless explicitly requested.
  - If the user requests formulas or numerical expressions, extract and return only the precise details found in the context—no interpretations.
 
User question: ${userMessage}`
                    console.log("Question ", questionWithContext);
                    generateResponse(incomingChatLi, questionWithContext);
                };

                chatInput.addEventListener("input", () => {
                    chatInput.style.height = `${inputInitHeight}px`;
                    chatInput.style.height = `${chatInput.scrollHeight}px`;
                });

                chatInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
                        e.preventDefault();
                        handleChat();
                    }
                });

                sendChatBtn.addEventListener("click", handleChat);
                closeBtn.addEventListener("click", () =>
                    document.body.classList.remove("show-chatbot")
                );

                chatbotToggler.addEventListener("click", () =>
                    document.body.classList.toggle("show-chatbot")
                );

                const showChatFlag = localStorage.getItem("show-chatbot");
                if (showChatFlag === "true") {
                    document.body.classList.add("show-chatbot");
                    localStorage.removeItem("show-chatbot");
                }

                enlargeChat.addEventListener("click", () => {
                    if (!isExpanded) {
                        chatBox.classList.add("expanded");
                        chatBox.style.width = "1050px";
                        chatBox.style.height = "600px";
                        enlargeChat.innerHTML = '<i class="material-icons">fullscreen_exit</i>';
                        enlargeChat.setAttribute("data-tooltip", "Minimize");
                    } else {
                        chatBox.classList.remove("expanded");
                        chatBox.style.width = "420px";
                        chatBox.style.height = "580px";
                        enlargeChat.innerHTML = '<i class="material-icons">fullscreen</i>';
                        enlargeChat.setAttribute("data-tooltip", "Maximize");
                    }
                    isExpanded = !isExpanded;
                });

                const holder = document.getElementById("drag")
                holder.addEventListener("mousedown", dragStart);

                //chatbot.addEventListener("mousedown", dragStart);
                document.addEventListener("mousemove", dragMove);
                document.addEventListener("mouseup", dragEnd);

                const themetoggle = () => {
                    const darkToggleBtn = document.getElementById("toggleDarkMode");

                    if (darkToggleBtn && !darkToggleBtn.classList.contains("listener-attached")) {
                        // Add click event for toggle
                        darkToggleBtn.addEventListener("click", () => {
                            document.body.classList.toggle("dark-mode");

                            // Save preference
                            if (document.body.classList.contains("dark-mode")) {
                                localStorage.setItem("chatbot-theme", "dark");
                                darkToggleBtn.innerHTML = `<i class="material-symbols-outlined">dark_mode</i>`
                            } else {
                                localStorage.setItem("chatbot-theme", "light");
                                darkToggleBtn.innerHTML = `<i class="material-symbols-outlined">light_mode</i>`
                            }
                        });

                        darkToggleBtn.classList.add("listener-attached");
                    }

                    // Apply saved theme on load
                    const savedTheme = localStorage.getItem("chatbot-theme");
                    if (savedTheme === "dark") {
                        document.body.classList.add("dark-mode");
                        if (darkToggleBtn) {
                            darkToggleBtn.innerHTML = `<i class="material-symbols-outlined">dark_mode</i>`;
                            darkToggleBtn.setAttribute("data-tooltip", "Light Mode");
                        }
                    } else {
                        if (darkToggleBtn) {
                            darkToggleBtn.innerHTML = `<i class="material-symbols-outlined">light_mode</i>`;
                            darkToggleBtn.setAttribute("data-tooltip", "Dark Mode")
                        }
                    }
                };
                document.addEventListener("click", themetoggle);


                // document.addEventListener("DOMContentLoaded", function () {
                //     const darkToggleBtn = document.getElementById("toggleDarkMode");
                //     darkToggleBtn.addEventListener("click", () => {
                //         document.body.classList.toggle("dark-mode");
                //     });
                // });

                // Attach on document click

                window.handleFeedback = function (button, type) {
                    const feedbackContainer = button.parentElement;
                    const allButtons = feedbackContainer.querySelectorAll("button");

                    allButtons.forEach(btn => btn.classList.remove("active"));
                    button.classList.add("active");

                    // Optional: send feedback to backend or log it
                    console.log(`Feedback given: ${type}`);
                }

            }
            return qlik.Promise.resolve();
        }
    };
});
