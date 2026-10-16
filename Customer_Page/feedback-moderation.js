(function () {
    const API_URL = "https://barbershop-reservation-system.onrender.com/api";
    let rulesPromise;

    function normalize(value) {
        return String(value)
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .replace(/[013457@$!]/g, (character) => ({
                "0": "o",
                "1": "i",
                "3": "e",
                "4": "a",
                "5": "s",
                "7": "t",
                "@": "a",
                "$": "s",
                "!": "i"
            })[character])
            .replace(/[^\p{L}\p{N}]+/gu, " ")
            .trim()
            .replace(/\s+/g, " ");
    }

    function loadRules() {
        if (!rulesPromise) {
            rulesPromise = fetch(`${API_URL}/feedback/moderation-rules`)
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(
                            `Feedback moderation rules request failed (${response.status}).`
                        );
                    }

                    const data = await response.json();
                    if (!Array.isArray(data.prohibitedTerms)) {
                        throw new Error("Feedback moderation rules are invalid.");
                    }

                    return data.prohibitedTerms;
                })
                .catch((error) => {
                    rulesPromise = null;
                    throw error;
                });
        }

        return rulesPromise;
    }

    async function containsProhibitedTerm(comment) {
        const terms = await loadRules();
        const normalizedComment = ` ${normalize(comment)} `;

        return terms.some((term) => {
            const normalizedTerm = normalize(term);
            return normalizedTerm &&
                normalizedComment.includes(` ${normalizedTerm} `);
        });
    }

    window.feedbackModeration = { containsProhibitedTerm };
})();
