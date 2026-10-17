
const mongoose = require("mongoose");

const otpSendLimitSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },

    count: {
        type: Number,
        required: true,
        default: 0
    },

    windowStart: {
        type: Date,
        required: true
    },

    expiresAt: {
        type: Date,
        required: true
    }
});

otpSendLimitSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
    "OtpSendLimit",
    otpSendLimitSchema
);
