const mongoose = require("mongoose");

const feedbackRateLimitSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        count: {
            type: Number,
            required: true,
            min: 1
        },
        expiresAt: {
            type: Date,
            required: true,
            index: {
                expires: 0
            }
        }
    },
    {
        collection: "feedback_rate_limits",
        versionKey: false
    }
);

module.exports = mongoose.model(
    "FeedbackRateLimit",
    feedbackRateLimitSchema
);
