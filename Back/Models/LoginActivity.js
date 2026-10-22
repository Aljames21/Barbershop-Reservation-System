const mongoose = require("mongoose");

const loginActivitySchema = new mongoose.Schema({
    accountName: {
        type: String,
        required: true,
        default: "Unknown account"
    },
    role: {
        type: String,
        enum: ["Admin", "Unknown"],
        required: true
    },
    result: {
        type: String,
        enum: ["Success", "Failed"],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

module.exports = mongoose.model("LoginActivity", loginActivitySchema);