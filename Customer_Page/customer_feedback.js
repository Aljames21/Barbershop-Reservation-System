const API_URL = "https://barbershop-reservation-system.onrender.com/api";
const feedbackForm = document.getElementById("feedback-form");
const feedbackMessage = document.getElementById("feedback-message");
const commentInput = document.getElementById("feedback-comment");
const characterCount = document.getElementById("comment-count");
const submitButton = document.getElementById("submit-review");
const bookingSummary = document.getElementById("booking-summary");
const reviewToken = new URLSearchParams(window.location.search).get("token");
const reviewEndpoint = reviewToken
    ? `${API_URL}/appointments/review/${encodeURIComponent(reviewToken)}`
    : null;
const isLocalPreview = window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

function showMessage(message, type) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `feedback-message is-visible is-${type}`;
}

function updateCharacterCount() {
    characterCount.textContent = `${commentInput.value.length} / 1000`;
}

function updateStars() {
    const selectedRating = Number(
        feedbackForm.querySelector('input[name="rating"]:checked')?.value || 0
    );

    feedbackForm.querySelectorAll(".rating-stars label").forEach((label) => {
        const rating = Number(label.htmlFor.replace("rating-", ""));
        label.classList.toggle("is-active", rating <= selectedRating);
    });
}

async function readResponse(response) {
    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error(`The feedback service returned an invalid response (${response.status}).`);
    }

    if (!response.ok) {
        throw new Error(result.message || `Feedback request failed (${response.status}).`);
    }

    return result;
}

async function loadReviewLink() {
    if (!reviewEndpoint) {
        if (isLocalPreview) {
            feedbackForm.hidden = false;
            submitButton.disabled = true;
            submitButton.textContent = "Preview Only";
            showMessage(
                "Design preview: open a valid Add Review link to submit feedback.",
                "info"
            );
            return;
        }

        showMessage("This review link is invalid, expired, or already used.", "error");
        return;
    }

    try {
        const response = await fetch(reviewEndpoint);
        const visit = await readResponse(response);

        document.getElementById("visit-service").textContent = visit.service;
        document.getElementById("visit-date").textContent = visit.date || "";
        bookingSummary.hidden = false;
        feedbackForm.hidden = false;
        feedbackMessage.className = "feedback-message";
        feedbackMessage.textContent = "";
    } catch (error) {
        console.error("Review link validation error:", error);
        showMessage(error.message, "error");
    }
}

commentInput.addEventListener("input", updateCharacterCount);
feedbackForm.querySelectorAll('input[name="rating"]').forEach((input) => {
    input.addEventListener("change", updateStars);
});

feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!feedbackForm.reportValidity() || !reviewEndpoint) {
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    showMessage("Submitting your review...", "info");

    try {
        const response = await fetch(reviewEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                rating: Number(
                    feedbackForm.querySelector('input[name="rating"]:checked').value
                ),
                comment: commentInput.value
            })
        });
        const result = await readResponse(response);

        feedbackForm.hidden = true;
        showMessage(result.message, result.feedback?.status === "Flagged" ? "warning" : "success");
    } catch (error) {
        console.error("Review submission error:", error);
        showMessage(error.message, "error");
        submitButton.disabled = false;
        submitButton.textContent = "Submit Review";
    }
});

loadReviewLink();
updateCharacterCount();
