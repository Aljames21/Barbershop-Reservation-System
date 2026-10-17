

const faqAnswers = [
    {
        keywords: [
            "price", "prices", "presyo", "magkano",
            "cost", "how much", "haircut", "haircuts"
        ],
        answer:
            "Our haircut services start at ₱150. Please visit our Services page to see the available services and their prices."
    },
   {
    keywords: [
        "what services do you offer",
        "what services",
        "services",
        "service",
        "offer",
        "offers",
        "haircut style",
        "haircut styles"
    ],
    answer:
        "We offer a variety of haircut and grooming services at Sañado's Barbershop. Please check our Services section for the available services, descriptions, and prices. You can then click Book Now to make a reservation."
    },
    {
        keywords: [
            "hours", "hour", "open", "close",
            "business hours", "operating hours", "oras"
        ],
        answer:
            "Our business hours are 8:00 AM to 8:00 PM, Monday to Sunday."
    },
    {
        keywords: [
            "location", "address", "where", "saan",
            "directions", "find you"
        ],
        answer:
            "Please check the Find Us section on our homepage for the barbershop's location."
    },
    {
        keywords: [
            "book", "booking", "appointment",
            "reservation", "reserve", "schedule"
        ],
        answer:
            "To book an appointment, click Book Now on our homepage, then follow the steps to select your barber, service, date, and available time."
    },
    {
        keywords: [
            "cancel", "cancellation", "cancel booking",
            "cancel appointment"
        ],
        answer:
            "If you need to cancel your appointment, open the booking management page and follow the available cancellation instructions."
    },
    {
        keywords: [
            "reschedule", "change booking",
            "change appointment", "another time"
        ],
        answer:
            "Please open the booking management page to check the available options for your appointment."
    },
    {
        keywords: [
            "payment", "pay", "cash", "gcash",
            "payment method", "mode of payment"
        ],
        answer:
            "Please contact the barbershop or check the booking page for the currently accepted payment methods."
    },
    {
        keywords: [
            "barber", "barbers", "staff", "team",
            "who will cut"
        ],
        answer:
            "You can view our barbers in the Team section and choose an available barber when making a reservation."
    },
    {
        keywords: [
            "thank you", "thanks", "thank"
        ],
        answer:
            "You're welcome! Thank you for choosing Sañado's Barbershop."
    },
    {
        keywords: [
            "hello", "hi", "hey", "good morning",
            "good afternoon", "good evening"
        ],
        answer:
            "Hello! Welcome to Sañado's Barbershop. I can help you with services, prices, business hours, location, and booking."
    }
];



function getFAQAnswer(message) {
    const question = message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s₱]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!question) {
        return "Please type a question so I can help you.";
    }

    const match = faqAnswers.find(faq =>
        faq.keywords.some(keyword => {
            const normalizedKeyword = keyword.toLowerCase();
            return question.includes(normalizedKeyword);
        })
    );

    return match
        ? match.answer
        : "Sorry, I don't have an answer for that yet. Please check our website or contact the barbershop for assistance.";
}



const chatToggle = document.getElementById("chat-toggle");
const chatWindow = document.getElementById("chat-window");
const chatClose = document.getElementById("chat-close");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const quickQuestions = document.querySelectorAll(
    ".chat-quick-questions [data-question]"
);

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

function waitForTyping(duration = 900) {
    return new Promise(resolve => setTimeout(resolve, duration));
}




async function sendFAQQuestion(question) {
    const message = question.trim();

    if (!message) return;

    addChatMessage(message, "user");

    const normalizedMessage = message.toLowerCase();

    const asksForServices =
        normalizedMessage.includes("service") ||
        normalizedMessage.includes("what haircuts") ||
        normalizedMessage.includes("haircut styles") ||
        normalizedMessage.includes("what do you offer");

    const typingBubble = showTypingIndicator();

    try {
        let answer;

        if (asksForServices) {
            // Fetch actual services from the backend.
            answer = await getLiveServicesAnswer();
        } else {
            // Brief typing effect for fixed FAQ answers.
            await waitForTyping(900);
            answer = getFAQAnswer(message);
        }

        // Keep the indicator visible briefly before showing the answer.
        await waitForTyping(300);

        typingBubble.remove();
        addChatMessage(answer, "bot");

    } catch (error) {
        console.error("Chatbot reply error:", error);

        typingBubble.remove();
        addChatMessage(
            "Sorry, something went wrong. Please try again.",
            "bot"
        );
    }
}



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

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();

    sendFAQQuestion(chatInput.value);
    chatInput.value = "";
    chatInput.focus();
});

quickQuestions.forEach((button) => {
    button.addEventListener("click", () => {
        sendFAQQuestion(button.dataset.question);
    });
});


const CHATBOT_API_BASE =
    "https://barbershop-reservation-system.onrender.com/api";


async function getLiveServicesAnswer() {
    try {
        const response = await fetch(
            `${CHATBOT_API_BASE}/services`
        );

        if (!response.ok) {
            throw new Error("Unable to load services.");
        }

        const services = await response.json();

        if (!Array.isArray(services)) {
            throw new Error("Unexpected services response.");
        }

        const activeServices = services.filter(
            service => service.status === "Active"
        );

        if (activeServices.length === 0) {
            return "Sorry, there are no active services available right now.";
        }

        const serviceList = activeServices.map(service => {
            const price = Number(service.price);
            const duration = Number(service.duration);

            const priceText = Number.isFinite(price)
                ? `₱${price.toLocaleString("en-PH")}`
                : "Price unavailable";

            const durationText =
                Number.isFinite(duration) && duration > 0
                    ? `${duration} minutes`
                    : "Duration unavailable";

            return `${service.name} — ${priceText} (${durationText})`;
        });

        return [
            "Here are our available services:",
            "",
            ...serviceList.map(
                (service, index) => `${index + 1}. ${service}`
            ),
            "",
            "Click Book Now to make a reservation."
        ].join("\n");

    } catch (error) {
        console.error("Chatbot services error:", error);

        return "I couldn't load our latest services right now. Please visit the Services section on our homepage and try again later.";
    }
}

