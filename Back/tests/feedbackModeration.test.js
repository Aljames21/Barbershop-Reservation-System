const assert = require("node:assert/strict");
const test = require("node:test");
const {
    classifyFeedbackComment
} = require("../Utils/feedbackModeration");
const {
    validateFeedbackInput
} = require("../Utils/feedbackValidation");
const Feedback = require("../Models/Feedback");
const {
    createFeedbackRateLimit
} = require("../Middleware/feedbackRateLimit");

test("publishes ordinary feedback, including negative criticism", () => {
    assert.equal(
        classifyFeedbackComment("The service was disappointing and too slow."),
        "clean"
    );
    assert.equal(
        classifyFeedbackComment("Great haircut and friendly staff."),
        "clean"
    );
});

test("blocks prohibited English and Filipino terms", () => {
    assert.equal(classifyFeedbackComment("This was FUCKING awful."), "prohibited");
    assert.equal(classifyFeedbackComment("Bobo ang barber."), "prohibited");
    assert.equal(classifyFeedbackComment("Gago ang barber."), "prohibited");
    assert.equal(classifyFeedbackComment("Putang ina."), "prohibited");
    assert.equal(classifyFeedbackComment("gago."), "prohibited");
    assert.equal(classifyFeedbackComment("Putangina mo."), "prohibited");
    assert.equal(classifyFeedbackComment("Tangina."), "prohibited");
    assert.equal(classifyFeedbackComment("Tarantado."), "prohibited");
    assert.equal(classifyFeedbackComment("Bobo."), "prohibited");
    assert.equal(classifyFeedbackComment("Tanga."), "prohibited");
    assert.equal(classifyFeedbackComment("Pakshet."), "prohibited");
    assert.equal(classifyFeedbackComment("Punyeta."), "prohibited");
    assert.equal(classifyFeedbackComment("Leche."), "prohibited");
    assert.equal(classifyFeedbackComment("Letse."), "prohibited");
    assert.equal(classifyFeedbackComment("Bwisit."), "prohibited");
    assert.equal(classifyFeedbackComment("Peste."), "prohibited");
    assert.equal(classifyFeedbackComment("Hayop."), "prohibited");
    assert.equal(classifyFeedbackComment("Hayop ka."), "prohibited");
    assert.equal(classifyFeedbackComment("Walang hiya."), "prohibited");
    assert.equal(classifyFeedbackComment("Tae."), "prohibited");
    assert.equal(classifyFeedbackComment("Puke."), "prohibited");
    assert.equal(classifyFeedbackComment("Pepe."), "prohibited");
    assert.equal(classifyFeedbackComment("Tite."), "prohibited");
    assert.equal(classifyFeedbackComment("Titi."), "prohibited");
    assert.equal(classifyFeedbackComment("Puwet."), "prohibited");
    assert.equal(classifyFeedbackComment("Pwet."), "prohibited");  
    assert.equal(classifyFeedbackComment("Pakyu."), "prohibited");
    assert.equal(classifyFeedbackComment("Oten."), "prohibited");
    assert.equal(classifyFeedbackComment("Fuck."), "prohibited");
    assert.equal(classifyFeedbackComment("Shit."), "prohibited");
    assert.equal(classifyFeedbackComment("Bitch."), "prohibited");
    assert.equal(classifyFeedbackComment("Asshole."), "prohibited");
    assert.equal(classifyFeedbackComment("Ass."), "prohibited");
    assert.equal(classifyFeedbackComment("Jerk."), "prohibited");
    assert.equal(classifyFeedbackComment("Anus."), "prohibited");
    assert.equal(classifyFeedbackComment("Motherfucker."), "prohibited");
    assert.equal(classifyFeedbackComment("Bastard."), "prohibited");
    assert.equal(classifyFeedbackComment("Cunt."), "prohibited");   
    assert.equal(classifyFeedbackComment("Dick."), "prohibited");
    assert.equal(classifyFeedbackComment("Dickhead."), "prohibited");
    assert.equal(classifyFeedbackComment("Pussy."), "prohibited");
    assert.equal(classifyFeedbackComment("Cock."), "prohibited");
    assert.equal(classifyFeedbackComment("Bilat."), "prohibited");
    assert.equal(classifyFeedbackComment("Uwagan."), "prohibited");
    assert.equal(classifyFeedbackComment("Yawa."), "prohibited");
    assert.equal(classifyFeedbackComment("Buang."), "prohibited");
    assert.equal(classifyFeedbackComment("Boang."), "prohibited");
    assert.equal(classifyFeedbackComment("Buwang."), "prohibited");
    assert.equal(classifyFeedbackComment("Kupal."), "prohibited"); 
    assert.equal(classifyFeedbackComment("Pokpok."), "prohibited");
    assert.equal(classifyFeedbackComment("Burikat"), "prohibited");
    assert.equal(classifyFeedbackComment("burikat"), "prohibited");
});

test("matches common capitalization, leetspeak, punctuation, and accent variants", () => {
    assert.equal(classifyFeedbackComment("f.u.c.k"), "flagged");
    assert.equal(classifyFeedbackComment("f*ck"), "flagged");
    assert.equal(classifyFeedbackComment("sh1t"), "prohibited");
    assert.equal(classifyFeedbackComment("PUTÁ"), "prohibited");
});

test("does not match prohibited words as harmless substrings", () => {
    assert.equal(classifyFeedbackComment("A classic haircut."), "clean");
    assert.equal(classifyFeedbackComment("The assistant was helpful."), "clean");
});

test("flags repeated-letter and spaced-out evasions for review", () => {
    assert.equal(classifyFeedbackComment("fuuuck"), "flagged");
    assert.equal(classifyFeedbackComment("f u c k"), "flagged");
});

test("validates feedback payload types, rating range, and comment length", () => {
    assert.deepEqual(
        validateFeedbackInput({ rating: 1, comment: "The service was slow." }),
        { value: { rating: 1, comment: "The service was slow." } }
    );
    assert.match(
        validateFeedbackInput({ rating: "5", comment: "Good." }).error,
        /rating/
    );
    assert.match(
        validateFeedbackInput({ rating: 6, comment: "Good." }).error,
        /rating/
    );
    assert.match(
        validateFeedbackInput({ rating: 5, comment: "   " }).error,
        /comment/
    );
    assert.match(
        validateFeedbackInput({ rating: 5, comment: "x".repeat(1001) }).error,
        /1000/
    );
    assert.ok(validateFeedbackInput(["not", "an object"]).error);
    assert.ok(
        validateFeedbackInput({
            rating: 5,
            comment: "Good.",
            extra: true
        }).error
    );
});

test("keeps the appointment feedback unique database constraint", () => {
    assert.ok(
        Feedback.schema.indexes().some(([fields, options]) =>
            fields.appointment === 1 && options.unique === true
        )
    );
});

test("supports archived feedback and preserves its previous status", () => {
    const statusPath = Feedback.schema.path("status");
    const archivedFromPath = Feedback.schema.path("archivedFromStatus");

    assert.ok(statusPath.enumValues.includes("Archived"));
    assert.deepEqual(archivedFromPath.enumValues, [
        "Pending",
        "Approved",
        "Hidden",
        "Flagged"
    ]);
});

test("rate limits feedback attempts across requests in the same window", async () => {
    const records = new Map();
    const counterModel = {
        async findOneAndUpdate(filter, update) {
            const current = records.get(filter._id) || {
                count: 0,
                expiresAt: update.$setOnInsert?.expiresAt
            };
            current.count += update.$inc.count;
            records.set(filter._id, current);
            return current;
        }
    };
    const middleware = createFeedbackRateLimit({
        counterModel,
        now: () => 1000,
        maxRequests: 2,
        windowMs: 60000
    });

    async function sendRequest() {
        const result = { nextCalled: false, statusCode: 200, headers: {}, body: null };
        const response = {
            set(name, value) {
                result.headers[name] = value;
                return this;
            },
            status(statusCode) {
                result.statusCode = statusCode;
                return this;
            },
            json(body) {
                result.body = body;
                return this;
            }
        };

        await middleware(
            { ip: "192.0.2.8" },
            response,
            () => {
                result.nextCalled = true;
            }
        );

        return result;
    }

    assert.equal((await sendRequest()).nextCalled, true);
    assert.equal((await sendRequest()).nextCalled, true);

    const limited = await sendRequest();
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers["Retry-After"], "59");
});
