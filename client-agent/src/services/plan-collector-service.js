const { HTTPS_REQUEST_OPTIONS, ENVIRONMENT, EnvironmentsEnum, API_KEY } = require("../consts");
const { makeInternalHttpRequest } = require("../http");
const { createSubLogger } = require("../logging");
const makeSpan = require('../utilities/span-utility');
const chuncker = require('../utilities/chunck-utility');

class PlanCollectorService {
    dbClient;
    logger;
    dbConfig;

    constructor(dbConfig, dbClient) {
        this.logger = createSubLogger(this.constructor.name);
        this.dbConfig = dbConfig;
        this.dbClient = dbClient;
    }

    async fetchData() {
        try {
            this.logger.info('fetchData - start');
            const query = `
            set pg_store_plans.plan_format = 'json';

select query, plan, last_call from pg_stat_statements A 
join pg_store_plans B on A.queryid = B.queryid_stat_statements
join pg_database C on B.dbid = C.oid
where 1=1
and datname = '${this.dbConfig.database}'
and last_call >= NOW() - interval '1h'
;`

            this.logger.debug('fetchData - calling dbClient.query with: ', query);
            const [_, { rows }] = await this.dbClient.query(query);
            this.logger.debug('fetchData - rows: ', rows);
            this.logger.info('fetchData - end');
            return rows;
        }
        catch (e) {
            this.logger.error('fetchData - error: ', e);
        }
    }

    shapeData(data) {
        try {
            this.logger.info('shapeData - start');
            data = data.map(el => makeSpan({ message: { ...el, plan: el?.plan }, ...this.dbConfig }));
            this.logger.debug('shapeData - data', data);
            this.logger.info('shapeData - end');
            return data;
        }
        catch (e) {
            this.logger.error('shapeData - error: ', e);
        }
    }

    async transferData(data) {
        try {
            this.logger.info('transferData - start');
            const { host, path, ...rest } = HTTPS_REQUEST_OPTIONS;
            const options = { ...rest, host: `${ENVIRONMENT === EnvironmentsEnum.PRODUCTION ? 'ingest.metisdata.io' : 'ingest-stg.metisdata.io'}`, path: '' };

            const promises = [];
            for (let chuckedData of chuncker(data.map((el) => JSON.stringify(el)))) {
                this.logger.debug('transferData - calling makeInternalHttpRequest: ', { data, options });
                promises.push(makeInternalHttpRequest(chuckedData, options));
            }
            const results = await Promise.allSettled(promises);
            this.logger.debug('transferData - results: ', results);
            this.logger.info('transferData - end');
        }
        catch (e) {
            this.logger.error('transferData - error: ', e);
        }
    }

    async isActiveMechanism() {
        try {
            this.logger.info('isActiveMechanism - start');
            const query = `select true ext_exists from pg_extension where extname = 'pg_store_plans';`
            const { rows } = await this.dbClient.query(query);
            this.logger.info('isActiveMechanism - end');
            return rows?.[0].ext_exists === true;
        }
        catch (e) {
            this.logger.error('isActiveMechanism - error: ', e);
            return false;
        }
    }

    async run() {
        try {
            if (await this.isActiveMechanism()) {
                this.logger.info('run - start');
                this.logger.debug('run - calling fetchData');
                const rowsFetched = await this.fetchData();
                this.logger.debug('run - calling shapeData rowsFetched: ', rowsFetched);
                const data = this.shapeData(rowsFetched);
                this.logger.debug('run - calling transferData with: ', data);
                await this.transferData(data);
                this.logger.info('run - end');
            }
            return;
        }
        catch (e) {
            this.logger.error('run - error: ', e);
        }
    }
}

module.exports = PlanCollectorService;