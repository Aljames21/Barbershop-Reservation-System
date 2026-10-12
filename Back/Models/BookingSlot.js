
const mongoose = require("mongoose");

const bookingSlotSchema = new mongoose.Schema(
    {
        date: {
            type: String,
            required: true
        },
        time: {
            type: String,
            required: true
        },
        barber: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Isang active reservation lamang sa bawat barber/date/time.
bookingSlotSchema.index(
    { date: 1, time: 1, barber: 1 },
    { unique: true, name: "unique_barber_date_time" }
);

module.exports = mongoose.model("BookingSlot", bookingSlotSchema);
