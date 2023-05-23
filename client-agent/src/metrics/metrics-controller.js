const metricsInstructions = require('./metrics.instructions.json');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('metrics-controller');

class MetricsController {
    constructor() { }

    load() { }
    process() { }

    _replaceQueryParams(query, params, dbConfigs) {
        try {
            params.map(param => query.replaceAll(param, dbConfigs[param]));
            return query;
        }
        catch (e) {
            logger.error(e);
        }
    }

    async init(dbConfigs) {
        try {
            const jobs = Object.keys(metricsInstructions);
            const numOfJobs = jobs.length;

            jobs.map(job => {
                const { params, frequency } = metricsInstructions[job];
                let { query } = metricsInstructions[job];

                if (params.length) {
                    query = this._replaceQueryParams(query, params, dbConfigs);
                }
            });
        }
        catch (e) {

        }
    }
}

module.exports = {

}