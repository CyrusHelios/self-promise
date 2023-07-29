import test from "ava";
import SelfPromise from "./index.js";

test("callback function of then return Promise object", async (t) => {
    const res = [];
    const p1 = SelfPromise.resolve()
        .then(() => {
            res.push(0);
            return SelfPromise.resolve(4);
        })
        .then((value) => {
            res.push(value);
        });

    const p2 = SelfPromise.resolve()
        .then(() => {
            res.push(1);
        })
        .then(() => {
            res.push(2);
        })
        .then(() => {
            res.push(3);
        })
        .then(() => {
            res.push(5);
        });

    await SelfPromise.all([p1, p2]);
    t.deepEqual(res, [0, 1, 2, 3, 4, 5]);
});

test("callback function of then return thenable object", async (t) => {
    const res = [];
    const p1 = SelfPromise.resolve()
        .then(() => {
            res.push(0);
            return {
                then(resolve) {
                    resolve(4);
                },
            };
        })
        .then((value) => {
            res.push(value);
        });

    const p2 = SelfPromise.resolve()
        .then(() => {
            res.push(1);
        })
        .then(() => {
            res.push(2);
        })
        .then(() => {
            res.push(3);
        })
        .then(() => {
            res.push(5);
        });

    await SelfPromise.all([p1, p2]);
    t.deepEqual(res, [0, 1, 2, 4, 3, 5]);
});

test("callback function of then return common object", async (t) => {
    const res = [];
    const p1 = SelfPromise.resolve()
        .then(() => {
            res.push(0);
            return 4;
        })
        .then((value) => {
            res.push(value);
        });

    const p2 = SelfPromise.resolve()
        .then(() => {
            res.push(1);
        })
        .then(() => {
            res.push(2);
        })
        .then(() => {
            res.push(3);
        })
        .then(() => {
            res.push(5);
        });

    await SelfPromise.all([p1, p2]);
    t.deepEqual(res, [0, 1, 4, 2, 3, 5]);
});
