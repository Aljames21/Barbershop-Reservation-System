const crypto = require("crypto");
const FeedbackRateLimit = require("../Models/FeedbackRateLimit");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

function createFeedbackRateLimit({
    counterModel = FeedbackRateLimit,
    now = Date.now,
    maxRequests = MAX_REQUESTS,
    windowMs = WINDOW_MS
} = {}) {
    return async function feedbackRateLimit(req, res, next) {
        const clientIp = req.ip || req.socket?.remoteAddress;

        if (!clientIp) {
            console.error("Feedback rate limit error: client IP is unavailable.");
            return res.status(503).json({
                message: "Feedback submission is temporarily unavailable."
            });
        }

        const currentTime = now();
        const windowStart = Math.floor(currentTime / windowMs) * windowMs;
        const key = crypto
            .createHash("sha256")
            .update(`${clientIp}:${windowStart}`)
            .digest("hex");

        try {
            let counter;

            try {
                counter = await counterModel.findOneAndUpdate(
                    { _id: key },
                    {
                        $inc: { count: 1 },
                        $setOnInsert: {
                            expiresAt: new Date(windowStart + windowMs)
                        }
                    },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true
                    }
                );
            } catch (error) {
                if (error.code !== 11000) throw error;

                counter = await counterModel.findOneAndUpdate(
                    { _id: key },
                    { $inc: { count: 1 } },
                    { new: true }
                );
            }

            if (!counter) {
                throw new Error("Feedback rate-limit counter was not returned.");
            }

            if (counter.count > maxRequests) {
                const retryAfter = Math.ceil(
                    (windowStart + windowMs - currentTime) / 1000
                );
                res.set("Retry-After", String(retryAfter));
                return res.status(429).json({
                    message: "Too many feedback attempts. Please try again later."
                });
            }

            return next();
        } catch (error) {
            console.error("Feedback rate limit error:", error);
            return res.status(503).json({
                message: "Feedback submission is temporarily unavailable."
            });
        }
    };
}

module.exports = createFeedbackRateLimit();
module.exports.createFeedbackRateLimit = createFeedbackRateLimit;
