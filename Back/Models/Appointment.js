const mongoose = require("mongoose");


const appointmentSchema = new mongoose.Schema({

    customerName: {
        type: String,
        required: true,
        trim: true
    },

   email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
},


phoneNumber: {
    type: String,
    trim: true,
    default: undefined
},


    service:String,

    price:{
        type:Number,
        default:0
    },

    barber:String,

    date:String,

    time:String,

    message:String,

    status:{
        type:String,
        default:"Pending"
    },

    cancelledAt:{
        type:Date,
        default:null
    },

    manageTokenHash: {
    type: String,
    default: undefined,
    select: false
},

    reviewTokenHash: {
        type: String,
        default: undefined,
        select: false,
        index: { sparse: true }
    },

    reviewTokenExpiresAt: {
        type: Date,
        default: undefined
    },

    createdAt:{
        type:String,
        default:()=>{

            return new Date().toLocaleString("en-PH",{
                timeZone:"Asia/Manila"
            });

        }
    }

});


appointmentSchema.index(
    { phoneNumber: 1, date: 1, time: 1 },
    {
        unique: true,
        name: "unique_active_phone_date_time",
        partialFilterExpression: {
            phoneNumber: { $type: "string" },
            status: { $in: ["Pending", "Confirmed"] }
        }
    }
);



module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);