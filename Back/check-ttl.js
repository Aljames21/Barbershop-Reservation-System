
require("dotenv").config();
const mongoose = require("mongoose");

async function checkTTL() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const indexes = await mongoose.connection.db
            .collection("usedotptokens")
            .indexes();

        const ttlIndex = indexes.find(
            index => index.name === "expiresAt_1"
        );

        console.log("TTL INDEX:", ttlIndex);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkTTL();
