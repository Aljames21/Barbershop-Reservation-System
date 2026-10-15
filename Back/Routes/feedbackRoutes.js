const express = require("express");
const mongoose = require("mongoose");
const Feedback = require("../Models/Feedback");
const verifyAdmin = require("../Middleware/authMiddleware");

const router = express.Router();
const appointmentDisplayFields = "customerName service date status";

router.get("/", async (req, res) => {
    try {
        const feedback = await Feedback.find({ status: "Approved" })
            .populate("appointment", appointmentDisplayFields)
            .sort({ createdAt: -1 })
            .lean();

        return res.json(
            feedback.filter((item) => item.appointment?.status === "Completed")
        );
    } catch (error) {
        console.error("Public feedback fetch error:", error);
        return res.status(500).json({
            message: "Unable to load customer feedback."
        });
    }
});

router.get("/admin", verifyAdmin, async (req, res) => {
    try {
        const feedback = await Feedback.find()
            .populate("appointment", appointmentDisplayFields)
            .sort({ createdAt: -1 })
            .lean();

        return res.json(feedback);
    } catch (error) {
        console.error("Admin feedback fetch error:", error);
        return res.status(500).json({
            message: "Unable to load customer feedback."
        });
    }
});

router.patch("/:id", verifyAdmin, async (req, res) => {
    const body = req.body || {};
    const { status } = body;

    if (
        Object.keys(body).length !== 1 ||
        !["Pending", "Approved", "Hidden"].includes(status)
    ) {
        return res.status(400).json({
            message: "Provide a valid feedback status."
        });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            message: "Invalid feedback ID."
        });
    }

    try {
        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        ).populate("appointment", appointmentDisplayFields);

        if (!feedback) {
            return res.status(404).json({
                message: "Feedback not found."
            });
        }

        return res.json(feedback);
    } catch (error) {
        console.error("Feedback moderation error:", error);
        return res.status(500).json({
            message: "Unable to update feedback."
        });
    }
});

router.delete("/:id", verifyAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            message: "Invalid feedback ID."
        });
    }

    try {
        const feedback = await Feedback.findByIdAndDelete(req.params.id);

        if (!feedback) {
            return res.status(404).json({
                message: "Feedback not found."
            });
        }

        return res.json({
            message: "Feedback deleted successfully."
        });
    } catch (error) {
        console.error("Feedback deletion error:", error);
        return res.status(500).json({
            message: "Unable to delete feedback."
        });
    }
});

module.exports = router;
