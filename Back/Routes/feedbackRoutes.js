const express = require("express");
const mongoose = require("mongoose");
const Feedback = require("../Models/Feedback");
const verifyAdmin = require("../Middleware/authMiddleware");
const { PROHIBITED_TERMS } = require("../Utils/feedbackModeration");

const router = express.Router();
const appointmentDisplayFields = "customerName service date status";

router.get("/moderation-rules", (req, res) => {
    return res.json({ prohibitedTerms: PROHIBITED_TERMS });
});

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
        const feedback = await Feedback.find({ status: { $ne: "Archived" } })
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

router.get("/admin/archived", verifyAdmin, async (req, res) => {
    try {
        const feedback = await Feedback.find({ status: "Archived" })
            .populate("appointment", appointmentDisplayFields)
            .sort({ createdAt: -1 })
            .lean();

        return res.json(feedback);
    } catch (error) {
        console.error("Archived feedback fetch error:", error);
        return res.status(500).json({
            message: "Unable to load archived feedback."
        });
    }
});

router.patch("/:id", verifyAdmin, async (req, res) => {
    const body = req.body || {};
    const { status } = body;

    if (
        Object.keys(body).length !== 1 ||
        !["Pending", "Approved", "Hidden", "Flagged", "Archived"].includes(status)
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
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({
                message: "Feedback not found."
            });
        }

        if (feedback.status === "Archived" && status !== "Archived") {
            return res.status(409).json({
                message: "Restore this feedback from the archive page first."
            });
        }

        if (status === "Archived" && feedback.status !== "Archived") {
            feedback.archivedFromStatus = feedback.status;
        } else if (status !== "Archived") {
            feedback.archivedFromStatus = undefined;
        }

        feedback.status = status;
        await feedback.save();
        await feedback.populate("appointment", appointmentDisplayFields);

        return res.json(feedback);
    } catch (error) {
        console.error("Feedback moderation error:", error);
        return res.status(500).json({
            message: "Unable to update feedback."
        });
    }
});

router.patch("/:id/restore", verifyAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            message: "Invalid feedback ID."
        });
    }

    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({
                message: "Feedback not found."
            });
        }

        if (feedback.status !== "Archived") {
            return res.status(409).json({
                message: "This feedback is not archived."
            });
        }

        const previousStatus = feedback.archivedFromStatus;
        feedback.status = ["Pending", "Approved", "Hidden", "Flagged"]
            .includes(previousStatus)
            ? previousStatus
            : "Flagged";
        feedback.archivedFromStatus = undefined;
        await feedback.save();
        await feedback.populate("appointment", appointmentDisplayFields);

        return res.json(feedback);
    } catch (error) {
        console.error("Feedback restore error:", error);
        return res.status(500).json({
            message: "Unable to restore feedback."
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
