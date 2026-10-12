
const mongoose = require("mongoose");

const barberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    specialization: {
        type: String,
        default: "Barber",
        trim: true
    },
    status: {
        type: String,
        default: "Active"
    },
    date: {
        type: String,
        default: ""
    },
    time: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model("Barber", barberSchema);
