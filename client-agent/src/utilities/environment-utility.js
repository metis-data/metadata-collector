const { makeHttpRequest } = require("../http")
const { IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC } = require('../consts');
const Errors = require('../config/error');
const { logger } = require("../logging");

async function isHostedOnAws() {
    try {
        const url = 'http://169.254.169.254/latest/meta-data/';
        const httpMethod = 'GET';

        await makeHttpRequest(url, httpMethod, null, null);
        return true;
    }
    catch (e) {
        switch (e.message) {
            case Errors.REQUEST_TIMEOUT:
                return false;
            default:
                logger.error(e);
                return true;
        }
    }
}

module.exports = {
    isHostedOnAws
}