
const mongoose = require("mongoose");

const otpVerificationSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },

    codeHash: {
        type: String,
        required: true
    },

    expiresAt: {
        type: Date,
        required: true
    },

    nextSendAt: {
        type: Date,
        required: true
    },

    attempts: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Automatically clean up expired OTP records.
// MongoDB TTL deletion may not happen immediately.
otpVerificationSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
    "OtpVerification",
    otpVerificationSchema
);
