const { makeHttpRequest } = require("../http")
const { IS_HOSTED_ON_AWS_REQUEST_TIMEOUT_IN_SEC} = require('../consts');

async function isHostedOnAws() {
    try {
        const url = 'http://169.254.169.254/latest/meta-data/';
        const httpMethod = 'GET';

        makeHttpRequest(httpMethod, url, )
    }
    catch (e) {
        
    }
}

module.exports = {
    isHostedOnAws
}