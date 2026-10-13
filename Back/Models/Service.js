
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        default: ""
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    duration: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    }
});

module.exports = mongoose.model("Service", serviceSchema);
