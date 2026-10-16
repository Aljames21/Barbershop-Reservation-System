const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createReviewToken,
    hashReviewToken,
    matchesReviewToken
} = require("../Utils/reviewToken");

test("review tokens are unpredictable-format, random bearer values", () => {
    const firstToken = createReviewToken();
    const secondToken = createReviewToken();

    assert.match(firstToken, /^[a-f\d]{64}$/);
    assert.notEqual(firstToken, secondToken);
    assert.notEqual(hashReviewToken(firstToken), firstToken);
});

test("review token matching rejects altered and malformed tokens", () => {
    const token = createReviewToken();
    const tokenHash = hashReviewToken(token);

    assert.equal(matchesReviewToken(token, tokenHash), true);
    assert.equal(matchesReviewToken(`${token.slice(0, -1)}0`, tokenHash), false);
    assert.equal(matchesReviewToken("not-a-token", tokenHash), false);
    assert.equal(matchesReviewToken(token, "invalid-hash"), false);
});
