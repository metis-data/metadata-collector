const lambdaLocal = require("lambda-local");
const assert = require('assert');
const path = require('path');

const executeLambda = async (event) => lambdaLocal.execute({
    event,
    lambdaPath: path.join(__dirname, '../index.js'),
    envfile: path.join(__dirname, './test.env'),
    profileName: 'default',
});

describe('tests /v1', () => {
    it("invalid payload is sent and should be failed", async () => {
        let err = null;
        try {
            const body = JSON.stringify({});
            const headers = {
                'x-api-key': '123'
            };
            const requestContext = {};

            const invalidEventPayload = {
                body,
                headers,
                requestContext,
            };
            await executeLambda(invalidEventPayload);
        }
        catch (e) {
            err = e;
        }
        finally {
            assert.notEqual(err, null);
        }
    });
    it("valid payload is sent and should be success", async () => {
        const body = JSON.stringify([
            {
                metricName: 'METRIC',
                value: 1,
                timestamp: new Date()
            }
        ]);
        const headers = {
            'x-api-key': '123'
        };
        const requestContext = {};

        const validEventPayload = {
            body,
            headers,
            requestContext,
        };
        const results = await executeLambda(validEventPayload);
        assert.equal(results.statusCode, 204);
    });
});

describe('tests /v2', () => {
    it("invalid payload is sent and should be failed", async () => {
        let err = null;
        try {
            const body = JSON.stringify({});
            const headers = {
                'x-api-key': '123',
                'x-api-version': 'v2'
            };
            const requestContext = {};

            const invalidEventPayload = {
                body,
                headers,
                requestContext,
            };
            await executeLambda(invalidEventPayload);
        }
        catch (e) {
            err = e;
        }
        finally {
            assert.notEqual(err, null);
        }
    });
    it("valid payload is sent and should be success", async () => {
        const body = JSON.stringify([
            {
                metricName: 'METRIC',
                value: 1,
                timestamp: Date.now() * 10e5
            }
        ]);
        const headers = {
            'x-api-key': '123',
            'x-api-version': 'v2'
        };
        const requestContext = {};

        const validEventPayload = {
            body,
            headers,
            requestContext,
        };
        const results = await executeLambda(validEventPayload);
        assert.equal(results.statusCode, 204);
    });
});