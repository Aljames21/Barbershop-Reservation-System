const express = require("express");
const router = express.Router();

const Barber = require("../Models/Barber");
const verifyAdmin = require("../Middleware/authMiddleware");


// GET ALL BARBERS


/* PUBLIC: GET BARBERS FOR CUSTOMER HOMEPAGE */
router.get("/", async (req, res) => {
    try {
        const barbers = await Barber.find()
            .select("name specialization status");

        res.json(barbers);
    } catch (error) {
        console.error("Error loading barbers:", error.message);
        res.status(500).json({
            message: "Unable to load barbers."
        });
    }
});



// ADD BARBER

router.post("/", verifyAdmin, async (req, res) => {

    try{

        const barber = new Barber(req.body);

        const saved = await barber.save();

        res.json(saved);


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

});


module.exports = router;