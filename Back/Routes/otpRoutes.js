
const express = require("express");
const crypto = require("crypto");
const OtpVerification = require("../Models/OtpVerification");
const OtpSendLimit = require("../Models/OtpSendLimit");
const router = express.Router();

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const DAILY_SMS_LIMIT = 10;
const DAILY_SMS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Temporary protection for each server instance.
// Additional persistent rate limiting is needed before production.
const ipRequests = new Map();
const IP_WINDOW_MS = 60 * 60 * 1000;
const MAX_IP_SENDS = 10;

function normalizePhone(value) {
    const phone = String(value || "").replace(/[\s-]/g, "");

    if (/^09\d{9}$/.test(phone)) {
        return "+63" + phone.slice(1);
    }

    if (/^\+639\d{9}$/.test(phone)) {
        return phone;
    }

    throw new Error("Enter a valid Philippine mobile number.");
}

function hashOtp(phone, code) {
    return crypto
        .createHmac("sha256", process.env.OTP_SECRET)
        .update(`${phone}:${code}`)
        .digest("hex");
}

function checkIpLimit(ip) {
    const now = Date.now();
    const current = ipRequests.get(ip);

    if (!current || now >= current.resetAt) {
        ipRequests.set(ip, {
            count: 1,
            resetAt: now + IP_WINDOW_MS
        });
        return true;
    }

    if (current.count >= MAX_IP_SENDS) {
        return false;
    }

    current.count++;
    return true;
}




async function reserveDailySmsLimit(phone) {
    const now = new Date();
    const newExpiry = new Date(
        now.getTime() + DAILY_SMS_WINDOW_MS
    );

    // Create a counter for a new phone number.
    try {
        const created = await OtpSendLimit.create({
            phoneNumber: phone,
            count: 1,
            windowStart: now,
            expiresAt: newExpiry
        });

        if (created) {
            return true;
        }
    } catch (error) {
        // Another request may have created the counter.
        if (error.code !== 11000) {
            throw error;
        }
    }

    // Reset an expired window and reserve the first request.
    const resetResult = await OtpSendLimit.findOneAndUpdate(
        {
            phoneNumber: phone,
            expiresAt: { $lte: now }
        },
        {
            $set: {
                count: 1,
                windowStart: now,
                expiresAt: newExpiry
            }
        },
        { returnDocument: "after" }
    );

    if (resetResult) {
        return true;
    }

    // Reserve another request without exceeding the limit.
    const result = await OtpSendLimit.findOneAndUpdate(
        {
            phoneNumber: phone,
            count: { $lt: DAILY_SMS_LIMIT },
            expiresAt: { $gt: now }
        },
        {
            $inc: { count: 1 }
        },
       { returnDocument: "after" }
    );

    return Boolean(result);
}


// SEND OTP
router.post("/send", async (req, res) => {
    let phone;

    try {
        phone = normalizePhone(req.body?.phoneNumber);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }

    if (
        !process.env.TEXTBEE_API_KEY ||
        !process.env.TEXTBEE_DEVICE_ID ||
        !process.env.OTP_SECRET ||
        process.env.OTP_SECRET.length < 32
    ) {
        return res.status(503).json({
            message: "OTP service is not configured."
        });
    }

    if (!checkIpLimit(req.ip)) {
        return res.status(429).json({
            message: "Too many OTP requests. Please try again later."
        });
    }
    const now = new Date();
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = hashOtp(phone, code);

 try {
    // Reserve the phone number atomically before sending SMS.

        // Reserve the phone number atomically before sending SMS.
        const result = await OtpVerification.updateOne(
            {
                phoneNumber: phone,
                $or: [
                    { nextSendAt: { $lte: now } },
                    { nextSendAt: { $exists: false } }
                ]
            },
            {
                $set: {
                    codeHash,
                    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
                    nextSendAt: new Date(
                        now.getTime() + RESEND_COOLDOWN_MS
                    ),
                    attempts: 0
                }
            }
        );

        if (result.matchedCount === 0) {
            try {
                await OtpVerification.create({
                    phoneNumber: phone,
                    codeHash,
                    expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
                    nextSendAt: new Date(
                        now.getTime() + RESEND_COOLDOWN_MS
                    ),
                    attempts: 0
                });
            } catch (error) {
                if (error.code === 11000) {
                    return res.status(429).json({
                        message: "Please wait before requesting another OTP."
                    });
                }
                throw error;
            }
        }
        const dailyAllowed = await reserveDailySmsLimit(phone);
       if (!dailyAllowed) {
    await OtpVerification.deleteOne({
        phoneNumber: phone,
        codeHash
    });

    return res.status(429).json({
        message: "Daily OTP request limit reached. Please try again after 24 hours."
    });
}


        const response = await fetch(
            `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(process.env.TEXTBEE_DEVICE_ID)}/send-sms`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.TEXTBEE_API_KEY
                },
                body: JSON.stringify({
                    recipients: [phone],
                    message: `Sanados Barbershop OTP: ${code}. Valid for 5 minutes. Do not share this code.`
                })
            }
        );

        if (!response.ok) {
            throw new Error(`SMS provider returned ${response.status}`);
        }

        return res.json({
            message: "OTP request submitted. Check your SMS inbox."
        });

    } catch (error) {
        console.error("OTP sending error:", error.message);

        return res.status(502).json({
            message: "Unable to request OTP. Please try again later."
        });
    }
});

// VERIFY OTP
router.post("/verify", async (req, res) => {
    let phone;

    try {
        phone = normalizePhone(req.body?.phoneNumber);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }

    const code = String(req.body?.code || "").trim();

    if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
            message: "Enter a valid 6-digit OTP."
        });
    }

    if (!process.env.OTP_SECRET ||
        process.env.OTP_SECRET.length < 32) {
        return res.status(503).json({
            message: "OTP service is not configured."
        });
    }

    try {
        const entry = await OtpVerification.findOneAndUpdate(
            {
                phoneNumber: phone,
                expiresAt: { $gt: new Date() },
                attempts: { $lt: MAX_ATTEMPTS }
            },
            { $inc: { attempts: 1 } },
            { returnDocument: "after" }
        );

        if (!entry) {
            return res.status(400).json({
                message: "Invalid, expired, or locked OTP."
            });
        }

        const expected = Buffer.from(entry.codeHash, "hex");
        const received = Buffer.from(hashOtp(phone, code), "hex");

        if (
            expected.length !== received.length ||
            !crypto.timingSafeEqual(expected, received)
        ) {
            return res.status(400).json({
                message: "Incorrect verification code."
            });
        }

        // Only one verification request can consume this OTP.
        const consumed = await OtpVerification.deleteOne({
            _id: entry._id,
            codeHash: entry.codeHash
        });

        if (consumed.deletedCount !== 1) {
            return res.status(400).json({
                message: "OTP has already been used."
            });
        }

        const expiresAt = Date.now() + 10 * 60 * 1000;

        const payload = Buffer.from(
            JSON.stringify({
                phoneNumber: phone,
                expiresAt
            })
        ).toString("base64url");

        const signature = crypto
            .createHmac("sha256", process.env.OTP_SECRET)
            .update(payload)
            .digest("base64url");

        return res.json({
            message: "Phone verified successfully.",
            phoneNumber: phone,
            verificationToken: `${payload}.${signature}`
        });

    } catch (error) {
        console.error("OTP verification error:", error.message);

        return res.status(500).json({
            message: "Unable to verify OTP. Please try again."
        });
    }
});

module.exports = router;
