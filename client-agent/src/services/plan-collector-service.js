const { HTTPS_REQUEST_OPTIONS, ENVIRONMENT, EnvironmentsEnum } = require("../consts");
const { makeInternalHttpRequest } = require("../http");
const { createSubLogger } = require("../logging");

class PlanCollectorService {
    dbClient;
    logger;

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

select query, plan::json, last_call from pg_stat_statements A 
join pg_store_plans B on A.queryid = B.queryid_stat_statements
join pg_database C on B.dbid = C.oid
where 1=1
and datname = '${this.dbConfig.database}'
and last_call >= NOW() - interval '1h'
;`

            this.logger.debug('fetchData - calling dbClient.query with: ', query);
            const [_, { rows }] = await this.dbClient.query(query);
            this.logger.info('fetchData - end');
            return rows;
        }
        catch (e) {
            logger.error('fetchData - error: ', e);
        }
    }

    shapeData(_data, dbConfig) {
        try {
            const apiKey = process.env?.API_KEY;
            const { rowsFetched, } = _data;
            const data = {
                data: rowsFetched, api_key: apiKey
            };
            return data;
        }
        catch (e) {

        }
    }

    async transferData(data) {
        try {
            this.logger.info('transferData - start');
            const { host, path, ...rest } = HTTPS_REQUEST_OPTIONS;
            const options = { ...rest, host: `${ENVIRONMENT === EnvironmentsEnum.PRODUCTION ? 'ingest.metisdata.io' : 'ingest-stg.metisdata.io'}`, path: '' };
            this.logger.debug('transferData - calling makeInternalHttpRequest: ', { data, options });
            const results = await makeInternalHttpRequest(data, options);
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
                const rowsFetched = await this.fetchData();
                const data = this.shapeData(rowsFetched, this.dbConfig);
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