
const mongoose = require("mongoose");

const usedOtpTokenSchema = new mongoose.Schema({
    tokenHash: {
        type: String,
        required: true,
        unique: true
    },

    expiresAt: {
        type: Date,
        required: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Automatically remove expired token records.
usedOtpTokenSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
    "UsedOtpToken",
    usedOtpTokenSchema
);
