const PROHIBITED_TERMS = Object.freeze([
    "cunt",
    "pakshet",
    "punyeta",
    "letche",
    "letse",
    "leche",
    "bwisit",
    "bwiset",
    "hayop",
    "hayop ka",
    "walang hiya",
    "peste",
    "tae",
    "kantot",
    "kantutan",
    "kantutin",
    "kantuten",
    "whore",
    "burat",
    "bayag",
    "jakol",
    "salsal",
    "mamatay ka na",
    "pisti",
    "pisting yawa",
    "pisteng yawa",
    "ingot",
    "engot",
    "ratbu",
    "nigger",
    "nigga",
    "shithole",
    "kill yourself",
    "go die",
    "die bastard",
    "you bastard",
    "bastard",
    "dumb",
    "dumbass",
    "slut",
    "dipshit",
    "shithead",
    "fuckface",
    "holyshit",
    "eatshit",
    "puke",
    "pepe",
    "tite",
    "titi",
    "oten",
    "otin",
    "oten",
    "ass",
    "jerk",
    "tits",
    "anus",
    "iyot",
    "uten",
    "pussy",
    "anus",
    "dick",
    "dickhead",
    "cock",
    "bilat",
    "uwagan",
    "yawa",
    "buang",
    "boang",
    "buwang",
    "kupal",
    "pokpok",
    "pwet",
    "puwet",
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

const PERSONAL_ATTACK_TERMS = Object.freeze([
    "idiot",
    "stupid",
    "useless",
    "worthless",
    "disgusting",
    "trash",
    "wala kayong silbi",
    "walang kwenta",
    "pangit ng gupit",
    "pangit",
    "panget"
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

function hasSuspiciousVariant(comment, normalizedText, terms) {
    const termsWithoutSpaces = terms.map((term) =>
        normalizeForModeration(term).replace(/\s+/g, "")
    );
    const collapsedWords = normalizedText
        .split(" ")
        .map((word) => word.replace(/(.)\1+/g, "$1"));

    if (containsWholeTerm(collapsedWords.join(" "), terms)) {
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
        terms
    );
}

function classifyFeedbackComment(comment) {
    const normalizedText = normalizeForModeration(comment);

    if (containsWholeTerm(normalizedText, PROHIBITED_TERMS)) {
        return "prohibited";
    }

    if (hasSuspiciousVariant(comment, normalizedText, PROHIBITED_TERMS)) {
        return "flagged";
    }

    if (
        containsWholeTerm(normalizedText, PERSONAL_ATTACK_TERMS) ||
        hasSuspiciousVariant(comment, normalizedText, PERSONAL_ATTACK_TERMS)
    ) {
        return "flagged";
    }

    return "clean";
}

module.exports = {
    PERSONAL_ATTACK_TERMS,
    PROHIBITED_TERMS,
    classifyFeedbackComment,
    normalizeForModeration
};
