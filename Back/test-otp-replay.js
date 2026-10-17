
require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");
const UsedOtpToken = require("./Models/UsedOtpToken");
const { verifyOtpToken } = require("./Utils/otpToken");

async function testReplay() {
    let session;

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("Missing MongoDB connection.");
        }

        await mongoose.connect(process.env.MONGODB_URI);

        if (mongoose.connection.name !== "sanados_test") {
            throw new Error("STOP: Not connected to sanados_test.");
        }

        console.log("Connected to TEST database.");

        // Create a temporary, locally signed test token.
        const payload = Buffer.from(JSON.stringify({
            phoneNumber: "+639000000000",
            expiresAt: Date.now() + 10 * 60 * 1000,
            testId: crypto.randomUUID()
        })).toString("base64url");

        const signature = crypto
            .createHmac("sha256", process.env.OTP_SECRET)
            .update(payload)
            .digest("base64url");

        const token = `${payload}.${signature}`;

        verifyOtpToken(token);

        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const expiresAt = new Date(
            JSON.parse(
                Buffer.from(payload, "base64url").toString("utf8")
            ).expiresAt
        );

        session = await mongoose.startSession();

        // First use: should succeed.
        await session.withTransaction(async () => {
            await UsedOtpToken.create(
                [{ tokenHash, expiresAt }],
                { session }
            );
        });

        console.log("FIRST USE: ACCEPTED");

        // Second use: must be rejected by unique index.
        try {
            await session.withTransaction(async () => {
                await UsedOtpToken.create(
                    [{ tokenHash, expiresAt }],
                    { session }
                );
            });

            console.error("REPLAY TEST FAILED: Token reused!");
        } catch (error) {
            if (
                error.code === 11000 &&
                (
                    error.keyPattern?.tokenHash === 1 ||
                    String(error.message).includes("tokenHash_1")
                )
            ) {
                console.log("SECOND USE: BLOCKED");
                console.log("REPLAY TEST PASSED");
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error("TEST ERROR:", error.message);
        process.exitCode = 1;
    } finally {
        if (session) await session.endSession();
        await mongoose.disconnect();
    }
}

testReplay();
