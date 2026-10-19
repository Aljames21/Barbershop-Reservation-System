
const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { rateLimit } = require("express-rate-limit");

const router = express.Router();

// Limit chatbot requests to help control API usage.
const chatbotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message:
            "You've sent too many questions. Please wait a few minutes and try again."
    }
});

const apiKey = process.env.GEMINI_API_KEY;

const genAI = apiKey
    ? new GoogleGenAI({ apiKey })
    : null;

const SYSTEM_INSTRUCTION = `
You are the AI customer support assistant for Sañado's Barbershop.

PERSONALITY:
- Be friendly, professional, polite, and helpful.
- Use simple, natural English.
- Keep answers concise, usually 2 to 4 sentences.
- Always provide complete sentences.

ACCURACY RULES:
- Never invent service names, prices, haircut styles, business hours,
  location details, payment methods, or business policies.
- Never claim that a service or haircut style is available unless
  reliable information confirms it.
- Do not assume a haircut is offered just because barbers generally
  know how to perform it.
- If availability cannot be verified, explain that clearly.
- Direct customers to the Services section or ask them to contact
  Sañado's Barbershop for confirmation.
- Never invent an address or unverified contact details.

BOOKING:
- Explain how customers can use the website's booking page.
- You cannot directly create, modify, or cancel appointments.
- Never claim a booking is complete or a time slot is available
  unless reliable information confirms it.

IMPORTANT:
- You do not automatically have access to the shop's database.
- Use only information provided in the conversation or reliable data.
- If information is missing or uncertain, do not guess.

Your goal is to help customers with accurate and trustworthy answers.
`;

router.post("/", chatbotLimiter, async (req, res) => {
    try {
        const { message } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                message: "Please enter a question."
            });
        }

        const question = message.trim();

        if (question.length > 1000) {
            return res.status(400).json({
                message:
                    "Your question is too long. Please use 1000 characters or less."
            });
        }

        if (!genAI) {
            console.error("Gemini API key is not configured.");

            return res.status(503).json({
                message:
                    "The AI assistant is not configured yet. Please try again later."
            });
        }

        const response = await genAI.models.generateContent({
            model: "gemini-3.8-flash",
            contents: question,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                maxOutputTokens: 500
            }
        });

        const answer =
            typeof response.text === "string"
                ? response.text.trim()
                : "";

        if (!answer) {
            console.error("Gemini returned an empty response.");

            return res.status(502).json({
                message:
                    "I could not generate an answer. Please try again."
            });
        }

        return res.json({ answer });

    } catch (error) {
        // Log only basic error details, not the API key or full response.
        console.error("Gemini API request failed:", {
            status: error.status,
            message: error.message
        });

        return res.status(502).json({
            message:
                "The AI assistant is temporarily unavailable. Please try again later."
        });
    }
});

module.exports = router;
