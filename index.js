const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

function resolvePromise(promise2, value, resolve, reject) {
    // 如果 then 方法返回的是自身 Promise 对象，返回错误信息
    if (value === promise2) {
        return reject(
            new TypeError("Chaining cycle detected for promise #<Promise>")
        );
    }

    if (typeof value === "object" || typeof value === "function") {
        if (value === null) {
            // 如果返回值是 null，
            // 直接调用 resolve 函数，promise2 的状态变为 fulfilled，
            // 返回值由下一个 then 方法的第一个回调函数接收。
            return resolve(value);
        }
        /**
         * called 变量控制 thanable 对象只调用 resolve 或 reject 函数一次
         */
        let called = false;
        try {
            /**
             * 将 then 函数取出来再执行的原因是：
             * 防止 thenable 对象被开发人员设置了一层代理，从而执行代理逻辑
             */
            const then = value.then;
            if (typeof then === "function") {
                /**
                 * 为了让 thenable 对象中的 then 方法稳定异步执行
                 */
                queueMicrotask(() => {
                    then.call(
                        value,
                        (value2) => {
                            if (called) return;
                            called = true;
                            // value2 可能是 Promise 对象，所以需要调用 resolvePromise 函数来进行处理
                            resolvePromise(promise2, value2, resolve, reject);
                        },
                        (err) => {
                            if (called) return;
                            called = true;
                            reject(err);
                        }
                    );
                });
            } else {
                // 如果 then 不是函数，同 null 情况一样的处理逻辑。
                // 直接调用 resolve 函数，promise2 的状态变为 fulfilled。
                resolve(value);
            }
        } catch (error) {
            // 如果 resolvePromise 或 rejectPromise 已经被调用，则忽略。
            if (called) return;
            called = true;
            reject(error);
        }
    } else {
        // 如果返回值是其他对象或者原始数据类型值，
        // 直接调用 resolve 函数，promise2 的状态变为 fulfilled。
        resolve(value);
    }
}
export default class SelfPromise {
    // 储存状态，初始值是 pending
    status = PENDING;
    // 成功之后的值
    value = null;
    // 失败之后的原因
    reason = null;

    // 保存所有的 onFulfilled 回调函数
    onFulfilledCallbacks = [];
    // 保存所有的 onRejected 回调函数
    onRejectedCallbacks = [];
    constructor(executor) {
        try {
            // 将 resolve 和 reject 传给 new Promsie 的回调函数
            executor(this.resolve, this.reject);
        } catch (error) {
            this.reject(error);
        }
    }
    // 箭头函数可以使函数里面的 this 始终指向 Promise 实例对象
    resolve = (value) => {
        // 只有状态是 pending 的情况下，才改变为 fulfilled 状态
        if (this.status === PENDING) {
            this.status = FULFILLED;
            this.value = value;
            // 执行所有的 onFulfilled 回调函数
            this.onFulfilledCallbacks.forEach((fn) => fn(value));
        }
    };

    reject = (reason) => {
        // 只有状态是 pending 的情况下，才改变为 rejected 状态
        if (this.status === PENDING) {
            this.status = REJECTED;
            this.reason = reason;
            // 执行 onRejected 回调函数
            this.onRejectedCallbacks.forEach((fn) => fn(reason));
        }
    };

    then(onFulfilled, onRejected) {
        const promise2 = new SelfPromise((resolve, reject) => {
            // onFulfilled 回调函数的默认值，then 方法值传递的原理
            onFulfilled =
                typeof onFulfilled === "function"
                    ? onFulfilled
                    : (value) => value;
            // onRejected 回调函数的默认值，then 方法值传递的原理
            onRejected =
                typeof onRejected === "function"
                    ? onRejected
                    : (reason) => {
                          throw reason;
                      };

            // 异步执行，等待 promise2 的完成初始化
            const fulfilledMicrotask = () => {
                queueMicrotask(() => {
                    try {
                        if (
                            this.value &&
                            typeof this.value.then === "function"
                        ) {
                            // 如果 resolve 函数传入的值是 Promise 对象或 thenable 对象
                            // 需要在其 then 方法的回调函数中调用 onFulfilled 和 onRejected
                            this.value.then(
                                (value) => {
                                    const v = onFulfilled(value);
                                    resolvePromise(
                                        promise2,
                                        value,
                                        resolve,
                                        reject
                                    );
                                },
                                (error) => {
                                    const v = onRejected(error);
                                    resolvePromise(
                                        promise2,
                                        error,
                                        resolve,
                                        reject
                                    );
                                }
                            );
                        } else {
                            // 获取上一个 then 方法的 fulfilled 回调函数的返回值
                            const v = onFulfilled(this.value);
                            // 根据返回值，改变 promise2 的状态，并建立与下一个 then 方法的关系
                            resolvePromise(promise2, v, resolve, reject);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            };

            const rejectedMicrotask = () => {
                queueMicrotask(() => {
                    try {
                        // 获取上一个 then 方法的 rejected 回调函数的返回值
                        const v = onRejected(this.reason);
                        //根据返回值，改变 promise2 的状态，并建立与下一个 then 方法的关系
                        resolvePromise(promise2, v, resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                });
            };
            if (this.status === FULFILLED) {
                // 异步执行 fulfilled 状态的回调函数
                fulfilledMicrotask();
            } else if (this.status === REJECTED) {
                // 异步执行 rejected 状态的回调函数
                rejectedMicrotask();
            } else {
                // pending 状态下保存所有的异步回调函数
                this.onFulfilledCallbacks.push(fulfilledMicrotask);
                this.onRejectedCallbacks.push(rejectedMicrotask);
            }
        });
        // 返回 Promise 对象
        return promise2;
    }
    catch(callback) {
        return this.then(null, callback);
    }
    finally(callback) {
        return this.then(
            // 值穿透以及 callback() 返回值不会传递给后面 then 方法的原理
            (value) => {
                callback();
                return MyPromise.resolve(value);
            },
            (reason) => {
                callback();
                return MyPromise.reject(reason);
            }
        );
    }

    static resolve(param) {
        // 如果参数是 Promise 实例对象，原封不动地放回这个对象
        if (param instanceof SelfPromise) {
            return param;
        }

        return new SelfPromise((resolve, reject) => {
            // 如果参数是 thenable 对象，放入微任务队列中执行
            if (param && typeof param.then === "function") {
                queueMicrotask(() => {
                    param.then(resolve, reject);
                });
            } else {
                // 其他情况直接调用 resolve 函数，返回 fulfilled 状态的 Promise 对象
                resolve(param);
            }
        });
    }

    static reject(param) {
        return new SelfPromise((resolve, reject) => {
            reject(param);
        });
    }

    static all(promiseIterator) {
        return new SelfPromise((resolve, reject) => {
            // 判断参数是否是具有 `Iterator` 接口的数据
            if (
                promiseIterator &&
                typeof promiseIterator[Symbol.iterator] === "function"
            ) {
                const res = []; // 结果数组
                let countRes = 0; // 记录数组中结果的个数
                const len = promiseIterator.length || promiseIterator.size;

                // 保存对应索引的结果
                function saveRes(value, index) {
                    res[index] = value;
                    if (++countRes === len) {
                        resolve(res);
                    }
                }
                // 返回迭代器对象
                const iterator = promiseIterator[Symbol.iterator]();
                // 遍历具有迭代器的数据结构，并且记录索引值
                for (
                    let i = 0, iteratorRes = iterator.next();
                    iteratorRes.done !== true;
                    i++, iteratorRes = iterator.next()
                ) {
                    SelfPromise.resolve(iteratorRes.value).then((value) => {
                        // 在对应索引位置上保存结果
                        saveRes(value, i);
                    }, reject);
                }
            } else {
                reject(new TypeError("Arguments is not iterable"));
            }
        });
    }

    static race(promiseIterator) {
        return new SelfPromise((resolve, reject) => {
            if (
                promiseIterator &&
                typeof promiseIterator[Symbol.iterator] === "function"
            ) {
                // 返回迭代器对象
                const iterator = promiseIterator[Symbol.iterator]();
                // 遍历具有迭代器的数据结构
                for (
                    let iteratorRes = iterator.next();
                    iteratorRes.done !== true;
                    iteratorRes = iterator.next()
                ) {
                    SelfPromise.resolve(iteratorRes.value).then(
                        resolve,
                        reject
                    );
                }
            } else {
                reject(new TypeError("Arguments is not iterable"));
            }
        });
    }
    // 所有 Promise 对象的状态都发生了改变，allSettled 返回的 Promise 对象状态变成 fulfilled
    static allSettled(promiseIterator) {
        return new SelfPromise((resolve, reject) => {
            if (
                promiseIterator &&
                typeof promiseIterator[Symbol.iterator] === "function"
            ) {
                const res = [];
                let countRes = 0;
                const len = promiseIterator.length || promiseIterator.size;

                function saveRes(value, index) {
                    res[index] = value;
                    if (++countRes === len) {
                        resolve(res);
                    }
                }
                // 返回迭代器对象
                const iterator = promiseIterator[Symbol.iterator]();
                // 遍历具有迭代器的数据结构，并且记录索引值
                for (
                    let i = 0, iteratorRes = iterator.next();
                    iteratorRes.done !== true;
                    i++, iteratorRes = iterator.next()
                ) {
                    SelfPromise.resolve(iteratorRes.value)
                        .then((value) => {
                            saveRes({ status: "fullfilled", value }, i);
                        })
                        .catch((reason) => {
                            saveRes({ status: "rejected", reason }, i);
                        });
                }
            } else {
                reject(new TypeError("Arguments is not iterable"));
            }
        });
    }
    // 如果有一个 Promise 对象的状态是 fulfilled，那么 any 就变成 fulfilled 状态
    // 如果所有 Promise 对象的状态是 rejected，那么 any 就变成 rejected 状态
    static any(promiseIterator) {
        return new SelfPromise((resolve, reject) => {
            if (
                promiseIterator &&
                typeof promiseIterator[Symbol.iterator] === "function"
            ) {
                const res = [];
                let countRes = 0;
                const len = promiseIterator.length || promiseIterator.size;

                function saveRes(reason, index) {
                    res[index] = reason;
                    if (++countRes === len) {
                        const err = new AggregateError(
                            res,
                            "All promises were rejected"
                        );
                        reject(err);
                    }
                }
                // 返回迭代器对象
                const iterator = promiseIterator[Symbol.iterator]();
                // 遍历具有迭代器的数据结构，并且记录索引值
                for (
                    let i = 0, iteratorRes = iterator.next();
                    iteratorRes.done !== true;
                    i++, iteratorRes = iterator.next()
                ) {
                    SelfPromise.resolve(iteratorRes.value).then(
                        resolve,
                        (reason) => {
                            // 在对应索引位置上保存结果
                            saveRes(reason, i);
                        }
                    );
                }
            } else {
                reject(new TypeError("Arguments is not iterable"));
            }
        });
    }
}
