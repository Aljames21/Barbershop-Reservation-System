
const crypto = require("crypto");

function verifyOtpToken(token) {
    if (typeof token !== "string" || token.length > 2048) {
        throw new Error("Invalid phone verification token.");
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        throw new Error("Invalid phone verification token.");
    }

    const [payload, signature] = parts;

    if (
        !/^[A-Za-z0-9_-]+$/.test(payload) ||
        !/^[A-Za-z0-9_-]+$/.test(signature)
    ) {
        throw new Error("Invalid phone verification token.");
    }

    const secret = process.env.OTP_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error("OTP service is not configured.");
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest();

    const suppliedSignature = Buffer.from(
        signature,
        "base64url"
    );

    if (
        suppliedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
            suppliedSignature,
            expectedSignature
        )
    ) {
        throw new Error("Invalid phone verification token.");
    }

    let data;

    try {
        data = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );
    } catch {
        throw new Error("Invalid phone verification token.");
    }

    if (
        !data ||
        typeof data.phoneNumber !== "string" ||
        !/^\+639\d{9}$/.test(data.phoneNumber) ||
        typeof data.expiresAt !== "number" ||
        !Number.isFinite(data.expiresAt) ||
        Date.now() >= data.expiresAt ||
        data.expiresAt > Date.now() + 10 * 60 * 1000
    ) {
        throw new Error("Phone verification token expired or invalid.");
    }

    return data.phoneNumber;
}

module.exports = { verifyOtpToken };
