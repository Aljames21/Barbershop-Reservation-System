(function () {
    "use strict";

    // =====================================================
    // API CONFIGURATION
    // =====================================================

    const API_URL =
        "https://barbershop-reservation-system.onrender.com/api";

    // =====================================================
    // FAQ ANSWERS
    // =====================================================

    const faqAnswers = [
        {
            keywords: ["business hours", "operating hours", "opening hours", "hours", "hour", "what time", "open", "close", "oras"],
            answer: "Our business hours are Monday to Sunday, from 8:00 AM to 8:00 PM."
        },
        {
            keywords: ["location", "address", "where are you", "where is your shop", "directions", "find you", "saan"],
            answer: "Please visit the Find Us section on our homepage to view Sañado's Barbershop location and directions."
        },
        {
            keywords: ["book", "booking", "appointment", "reservation", "reserve", "schedule"],
            answer: "To book an appointment, click Book Now on our homepage. Select your preferred service, barber, date, and available time, then follow the instructions to complete your booking."
        },
        {
            keywords: ["cancel", "cancellation", "cancel booking", "cancel appointment"],
            answer: "To cancel an appointment, open the booking management page and follow the cancellation instructions provided there."
        },
        {
            keywords: ["reschedule", "change booking", "change appointment", "another time"],
            answer: "To change your appointment, open the booking management page and check the available options."
        },
        {
            keywords: ["payment method", "mode of payment", "payment", "pay", "cash", "gcash"],
            answer: "For the latest information about accepted payment methods, please check the booking page or contact Sañado's Barbershop."
        },
        {
            keywords: ["barber", "barbers", "staff", "team", "who will cut"],
            answer: "You can view our barbers in the Team section of our website. During booking, you can select an available barber."
        },
        {
            keywords: ["thank you", "thanks", "thank"],
            answer: "You're welcome! Thank you for choosing Sañado's Barbershop."
        },
        {
            keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
            answer: "Hello! Welcome to Sañado's Barbershop. I can help you with our services, prices, business hours, location, and appointments."
        }
    ];

    // =====================================================
    // FAQ MATCHING
    // =====================================================

    function normalizeQuestion(message) {
        return String(message || "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s₱]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function findFAQAnswer(message) {
        const question = normalizeQuestion(message);

        if (!question) return null;

        for (const faq of faqAnswers) {
            const matched = faq.keywords.some(keyword => {
                const normalizedKeyword = normalizeQuestion(keyword);
                return (` ${question} `).includes(` ${normalizedKeyword} `);
            });

            if (matched) return faq.answer;
        }

        return null;
    }

    // =====================================================
    // CHAT ELEMENTS
    // =====================================================

    const chatToggle = document.getElementById("chat-toggle");
    const chatWindow = document.getElementById("chat-window");
    const chatClose = document.getElementById("chat-close");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatMessages = document.getElementById("chat-messages");

    const quickQuestions = document.querySelectorAll(
        ".chat-quick-questions [data-question]"
    );

    // Stop safely if the chatbot HTML elements are missing.
    if (
        !chatToggle ||
        !chatWindow ||
        !chatClose ||
        !chatForm ||
        !chatInput ||
        !chatMessages
    ) {
        console.error(
            "Chatbot initialization failed: one or more HTML elements are missing."
        );
        return;
    }

    // =====================================================
    // DISPLAY CHAT MESSAGES
    // =====================================================

    function addChatMessage(message, sender) {
        const bubble = document.createElement("div");

        bubble.classList.add("chat-bubble", sender);
        bubble.textContent = message;

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator() {
        const bubble = document.createElement("div");

        bubble.className = "chat-bubble bot typing-bubble";
        bubble.setAttribute("aria-label", "Assistant is typing");
        bubble.setAttribute("role", "status");

        for (let i = 0; i < 3; i++) {
            const dot = document.createElement("span");
            dot.className = "typing-dot";
            bubble.appendChild(dot);
        }

        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return bubble;
    }

    function waitForTyping(duration = 500) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    // =====================================================
    // LIVE SERVICES FROM BACKEND / DATABASE
    // =====================================================

    async function getLiveServicesAnswer() {
        try {
            const response = await fetch(`${API_URL}/services`);

            if (!response.ok) {
                throw new Error(`Services API returned ${response.status}`);
            }

            const services = await response.json();

            if (!Array.isArray(services)) {
                throw new Error("Unexpected services response.");
            }

            const activeServices = services.filter(service =>
                String(service.status || "").toLowerCase() === "active"
            );

            if (activeServices.length === 0) {
                return "Sorry, there are no active services available right now. Please contact the barbershop for assistance.";
            }

            const serviceList = activeServices.map((service, index) => {
                const price = Number(service.price);
                const duration = Number(service.duration);

                const priceText =
                    service.price !== undefined &&
                    service.price !== null &&
                    service.price !== "" &&
                    Number.isFinite(price)
                        ? `₱${price.toLocaleString("en-PH")}`
                        : "Price unavailable";

                const durationText =
                    service.duration !== undefined &&
                    service.duration !== null &&
                    service.duration !== "" &&
                    Number.isFinite(duration) &&
                    duration > 0
                        ? `${duration} minutes`
                        : "Duration unavailable";

                return `${index + 1}. ${service.name} — ${priceText} (${durationText})`;
            });

            return [
                "Here are our currently available services and prices:",
                "",
                ...serviceList,
                "",
                "Click Book Now on our website to make a reservation."
            ].join("\n");

        } catch (error) {
            console.error("Chatbot services error:", error);

            return "I couldn't load the latest service prices right now. Please visit the Services section on our website or try again later.";
        }
    }

    // =====================================================
    // QUESTION DETECTION
    // =====================================================

    function asksAboutPrices(message) {
        const question = normalizeQuestion(message);

        const priceKeywords = [
            "price",
            "prices",
            "pricing",
            "cost",
            "how much",
            "presyo",
            "magkano"
        ];

        const mentionsHaircut =
            question.includes("haircut") ||
            question.includes("hair cut") ||
            question.includes("haircuts");

        const asksForPrice = priceKeywords.some(keyword =>
            (` ${question} `).includes(` ${keyword} `)
        );

        return asksForPrice || (
            mentionsHaircut &&
            (
                question.includes("service") ||
                question.includes("offer")
            )
        );
    }

    function asksAboutServices(message) {
        const question = normalizeQuestion(message);

        const serviceKeywords = [
            "services",
            "service",
            "what do you offer",
            "what services",
            "available services",
            "haircut styles",
            "haircut style",
            "list of services"
        ];

        return serviceKeywords.some(keyword =>
            (` ${question} `).includes(` ${normalizeQuestion(keyword)} `)
        );
    }

    function asksAboutBusinessHours(message) {
        const question = normalizeQuestion(message);

        const keywords = [
            "business hours",
            "operating hours",
            "opening hours",
            "hours",
            "what time",
            "when do you open",
            "when do you close",
            "are you open",
            "oras"
        ];

        return keywords.some(keyword =>
            (` ${question} `).includes(` ${normalizeQuestion(keyword)} `)
        );
    }

    function getBusinessHoursAnswer() {
        return "Our business hours are Monday to Sunday, from 8:00 AM to 8:00 PM.";
    }

    function asksIfOpenNow(message) {
        const question = normalizeQuestion(message);

        return [
            "are you open right now",
            "are you open now",
            "are you currently open",
            "is the shop open",
            "is your shop open",
            "open right now"
        ].some(keyword => question.includes(keyword));
    }

    function getCurrentOpenStatus() {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date());

        const hour = Number(
            parts.find(part => part.type === "hour").value
        );

        const minute = Number(
            parts.find(part => part.type === "minute").value
        );

        const currentMinutes = hour * 60 + minute;
        const openingMinutes = 8 * 60;
        const closingMinutes = 20 * 60;

        if (
            currentMinutes >= openingMinutes &&
            currentMinutes < closingMinutes
        ) {
            return "Based on our regular business hours, Sañado's Barbershop should be open now. Our business hours are 8:00 AM to 8:00 PM, Monday to Sunday.";
        }

        return "Based on our regular business hours, Sañado's Barbershop should be closed now. Our business hours are 8:00 AM to 8:00 PM, Monday to Sunday.";
    }

    function asksAboutSpecificAvailability(message) {
        const question = normalizeQuestion(message);

        return [
            "available",
            "do you have",
            "do you offer",
            "do you do",
            "can you do",
            "can i get"
        ].some(keyword => question.includes(keyword));
    }

    async function getServiceAvailabilityAnswer(message) {
        try {
            const response = await fetch(`${API_URL}/services`);

            if (!response.ok) {
                throw new Error(`Services API returned ${response.status}`);
            }

            const services = await response.json();

            if (!Array.isArray(services)) {
                throw new Error("Unexpected services response.");
            }

            const activeServices = services.filter(service =>
                String(service.status || "").toLowerCase() === "active"
            );

            const question = normalizeQuestion(message);

            const matchedService = activeServices.find(service => {
                const name = normalizeQuestion(service.name || "");
                return name && question.includes(name);
            });

            if (matchedService) {
                const price = Number(matchedService.price);

                const priceText =
                    matchedService.price !== undefined &&
                    matchedService.price !== null &&
                    matchedService.price !== "" &&
                    Number.isFinite(price)
                        ? `₱${price.toLocaleString("en-PH")}`
                        : "Please contact us for the current price";

                return `Yes! ${matchedService.name} is listed among our active services. The listed price is ${priceText}. Actual appointment availability depends on the available booking slots.`;
            }

            return "I couldn't find that service in our active services list. Please contact Sañado's Barbershop to confirm whether it can be accommodated.";

        } catch (error) {
            console.error("Service availability error:", error);

            return "I couldn't verify that service right now. Please check our Services section or contact Sañado's Barbershop.";
        }
    }

    // =====================================================
    // SEND QUESTION
    // =====================================================

    async function sendFAQQuestion(question) {
        const message = String(question || "").trim();

        if (!message) return;

        addChatMessage(message, "user");

        const typingBubble = showTypingIndicator();

        try {
            let answer;

            // 1. Get live prices and services from the database.
            if (
                asksAboutPrices(message) ||
                asksAboutServices(message)
            ) {
                answer = await getLiveServicesAnswer();
            }

            // 2. Check whether the shop should be open right now.
            else if (asksIfOpenNow(message)) {
                answer = getCurrentOpenStatus();
            }

            // 3. Answer regular business-hours questions.
            else if (asksAboutBusinessHours(message)) {
                answer = getBusinessHoursAnswer();
            }

            // 4. Verify specific service availability.
            else if (asksAboutSpecificAvailability(message)) {
                answer = await getServiceAvailabilityAnswer(message);
            }

            // 5. Use existing FAQ answers for known questions.
            else {
                answer = findFAQAnswer(message);
            }

            // 6. If no FAQ matches, ask the AI backend.
            if (!answer) {
                const response = await fetch(`${API_URL}/chatbot`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: message
                    })
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        `AI chatbot request failed with status ${response.status}.`
                    );
                }

                answer =
                    typeof data.answer === "string"
                        ? data.answer.trim()
                        : "";

                if (!answer) {
                    throw new Error("The AI returned an empty answer.");
                }
            }

            await waitForTyping();

            typingBubble.remove();
            addChatMessage(answer, "bot");

        } catch (error) {
            console.error("Chatbot reply error:", error);

            typingBubble.remove();

            addChatMessage(
                "Sorry, I couldn't process your question right now. Please try again later.",
                "bot"
            );
        }
    }

    // =====================================================
    // CHAT OPEN / CLOSE
    // =====================================================

    chatToggle.addEventListener("click", () => {
        chatWindow.hidden = false;
        chatToggle.hidden = true;
        chatInput.focus();
    });

    chatClose.addEventListener("click", () => {
        chatWindow.hidden = true;
        chatToggle.hidden = false;
        chatToggle.focus();
    });

    // =====================================================
    // CHAT FORM
    // =====================================================

    chatForm.addEventListener("submit", event => {
        event.preventDefault();

        const message = chatInput.value;
        chatInput.value = "";

        sendFAQQuestion(message);
        chatInput.focus();
    });

    // =====================================================
    // QUICK QUESTIONS
    // =====================================================

    quickQuestions.forEach(button => {
        button.addEventListener("click", () => {
            sendFAQQuestion(button.dataset.question);
        });
    });

})();