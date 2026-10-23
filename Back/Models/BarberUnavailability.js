
const mongoose = require("mongoose");

const barberUnavailabilitySchema = new mongoose.Schema(
    {
        barber: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        date: {
            type: String,
            required: true
        },
        time: {
            type: String,
            required: true
        },
        reason: {
            type: String,
            required: true,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);

barberUnavailabilitySchema.index(
    { barber: 1, date: 1, time: 1 },
    {
        unique: true,
        name: "unique_barber_unavailability_slot"
    }
);

module.exports = mongoose.model(
    "BarberUnavailability",
    barberUnavailabilitySchema
);
