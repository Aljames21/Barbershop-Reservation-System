const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({

    
    // Preserve appointment details after permanent deletion
    customerName: {
        type: String,
        trim: true,
        default: ""
    },
    service: {
        type: String,
        trim: true,
        default: ""
    },
    appointmentDate: {
        type: String,
        default: ""
    },
    appointmentStatus: {
        type: String,
        default: ""
    },

    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Appointment",
        required: true,
        unique: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: Number.isInteger
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Hidden", "Flagged", "Archived"],
        default: "Pending"
    },
    archivedFromStatus: {
        type: String,
        enum: ["Pending", "Approved", "Hidden", "Flagged"],
        default: undefined
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Feedback", feedbackSchema);
