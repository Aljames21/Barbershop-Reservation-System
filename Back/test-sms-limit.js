
require("dotenv").config();

const mongoose = require("mongoose");
const OtpSendLimit = require("./Models/OtpSendLimit");
const otpRoutes = require("./Routes/otpRoutes");

async function runTest() {
    const database = new URL(process.env.MONGODB_URI).pathname.slice(1);

    if (database !== "sanados_test") {
        throw new Error("STOP: Test database only!");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to TEST database.");

    const phone = "+639" + String(Date.now()).slice(-9);

    try {
        await OtpSendLimit.init();

        for (let i = 1; i <= 6; i++) {
            const allowed = await otpRoutes.reserveDailySmsLimit(phone);
            console.log(`Request ${i}: ${allowed ? "ALLOWED" : "BLOCKED"}`);

            if (allowed !== (i <= 5)) {
                throw new Error(`Unexpected result at request ${i}`);
            }
        }

        console.log("5-REQUEST LIMIT: PASSED");

        // Simulate an expired 24-hour window.
        await OtpSendLimit.updateOne(
            { phoneNumber: phone },
            { $set: { expiresAt: new Date(Date.now() - 1000) } }
        );

        const allowedAfterExpiry =
            await otpRoutes.reserveDailySmsLimit(phone);

        if (!allowedAfterExpiry) {
            throw new Error("24-hour reset failed");
        }

        console.log("24-HOUR RESET: PASSED");
        console.log("NO SMS SENT");
    } finally {
        await OtpSendLimit.deleteOne({ phoneNumber: phone });
        await mongoose.disconnect();
    }
}

runTest().catch(error => {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
});
