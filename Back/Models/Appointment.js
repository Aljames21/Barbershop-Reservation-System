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

    createdAt:{
        type:String,
        default:()=>{

            return new Date().toLocaleString("en-PH",{
                timeZone:"Asia/Manila"
            });

        }
    }

});


module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);