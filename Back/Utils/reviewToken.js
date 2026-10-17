const crypto = require("crypto");

function createReviewToken() {
    let token = "";

    do {
        token = crypto.randomBytes(32).toString("hex");
    } while (token.endsWith("0"));

    return token;
}

function hashReviewToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function matchesReviewToken(token, storedHash) {
    if (
        typeof token !== "string" ||
        !/^[a-f\d]{64}$/i.test(token) ||
        typeof storedHash !== "string" ||
        !/^[a-f\d]{64}$/i.test(storedHash)
    ) {
        return false;
    }

    const suppliedBuffer = Buffer.from(hashReviewToken(token), "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    return crypto.timingSafeEqual(suppliedBuffer, storedBuffer);
}

module.exports = {
    createReviewToken,
    hashReviewToken,
    matchesReviewToken
};
