const PROHIBITED_TERMS = Object.freeze([
    "asshole",
    "assholes",
    "bitch",
    "bitches",
    "bobo",
    "bullshit",
    "fuck",
    "fucked",
    "fucker",
    "fuckers",
    "fucks",
    "fucking",
    "gago",
    "motherfucker",
    "motherfuckers",
    "burikat",
    "tarantado",
    "pakyu",
    "puta",
    "putang ina",
    "putang ina mo",
    "putangina",
    "putanginamo",
    "shit",
    "shits",
    "shitty",
    "tanga",
    "tangina",
    "ulol"
]);

function normalizeForModeration(value) {
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

function containsWholeTerm(normalizedText, terms) {
    const paddedText = ` ${normalizedText} `;

    return terms.some((term) => {
        const normalizedTerm = normalizeForModeration(term);
        return normalizedTerm && paddedText.includes(` ${normalizedTerm} `);
    });
}

function hasSuspiciousVariant(comment, normalizedText) {
    const termsWithoutSpaces = PROHIBITED_TERMS.map((term) =>
        normalizeForModeration(term).replace(/\s+/g, "")
    );
    const collapsedWords = normalizedText
        .split(" ")
        .map((word) => word.replace(/(.)\1+/g, "$1"));

    if (containsWholeTerm(collapsedWords.join(" "), PROHIBITED_TERMS)) {
        return true;
    }

    for (let start = 0; start < collapsedWords.length; start += 1) {
        if (collapsedWords[start].length !== 1) continue;

        let run = "";
        for (let end = start; end < collapsedWords.length; end += 1) {
            if (collapsedWords[end].length !== 1) break;
            run += collapsedWords[end];
            if (termsWithoutSpaces.includes(run)) return true;
        }
    }

    const maskedTokens = String(comment)
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}*?]+/gu) || [];
    for (const token of maskedTokens) {
        if (!/[*?]/.test(token)) continue;

        const candidate = normalizeForModeration(token.replace(/[*?]/g, ""));
        if (!candidate || candidate.includes(" ")) continue;

        if (termsWithoutSpaces.some((term) => {
            if (candidate.length !== term.length - 1) return false;

            for (let index = 1; index < term.length - 1; index += 1) {
                if (
                    `${term.slice(0, index)}${term.slice(index + 1)}` ===
                    candidate
                ) {
                    return true;
                }
            }

            return false;
        })) {
            return true;
        }
    }

    const punctuationJoined = String(comment)
        .normalize("NFKC")
        .replace(/([\p{L}\p{N}])[\p{P}\p{S}]+(?=[\p{L}\p{N}])/gu, "$1");

    return containsWholeTerm(
        normalizeForModeration(punctuationJoined),
        PROHIBITED_TERMS
    );
}

function classifyFeedbackComment(comment) {
    const normalizedText = normalizeForModeration(comment);

    if (containsWholeTerm(normalizedText, PROHIBITED_TERMS)) {
        return "prohibited";
    }

    if (hasSuspiciousVariant(comment, normalizedText)) {
        return "flagged";
    }

    return "clean";
}

module.exports = {
    PROHIBITED_TERMS,
    classifyFeedbackComment,
    normalizeForModeration
};
