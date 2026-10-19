
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
    enum: ["Available", "Unavailable", "On Leave", "Active"],
    default: "Available"
},
    date: {
        type: String,
        default: ""
    },
    
    time: {
        type: String,
        default: ""
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }

});

module.exports = mongoose.model("Barber", barberSchema);
