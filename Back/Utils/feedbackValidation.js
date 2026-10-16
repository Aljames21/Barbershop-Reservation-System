function validateFeedbackInput(body) {
    if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(body, "rating") ||
        !Object.prototype.hasOwnProperty.call(body, "comment")
    ) {
        return { error: "Provide only a rating and comment." };
    }

    const { rating } = body;
    if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
    ) {
        return { error: "Please choose a rating from 1 to 5." };
    }

    if (typeof body.comment !== "string") {
        return { error: "Please enter a text comment." };
    }

    const comment = body.comment.trim();
    if (!comment || comment.length > 1000) {
        return { error: "Please enter a comment of 1 to 1000 characters." };
    }

    return { value: { rating, comment } };
}

module.exports = { validateFeedbackInput };
