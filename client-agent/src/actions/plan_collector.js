const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const makeSpan = require('../utilities/span-utility');
const chuncker = require('../utilities/chunck-utility');

class PlanCollector {
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
      const query = `
            set pg_store_plans.plan_format = 'json';

select query, plan, last_call, B.mean_time as duration, A.queryid as query_id from pg_stat_statements A 
join pg_store_plans B on A.queryid = B.queryid_stat_statements
join pg_database C on B.dbid = C.oid
where 1=1
and datname = '${this.dbConfig.database}'
and last_call >= NOW() - interval '1h'
;`;

      this.logger.debug('fetchData - calling dbClient.query with: ', query);
      const [_, { rows }] = await this.dbClient.query(query);
      this.logger.debug('fetchData - rows: ', rows);
      return rows;
    } catch (e) {
      this.logger.error('fetchData - error: ', e);
    }
  }

  shapeData(data) {
    try {
      data = data.map((el) => makeSpan({ message: { ...el, plan: el?.plan }, ...this.dbConfig }));
      this.logger.debug('shapeData - data', data);
      return data;
    } catch (e) {
      this.logger.error('shapeData - error: ', e);
    }
  }

  async transferData({ payload, options }) {
    const { data = [] } = payload;
    const promises = [];
    for (let chuckedData of chuncker(data?.map((el) => JSON.stringify(el)))) {
      this.logger.debug('transferData - calling makeInternalHttpRequest: ', { data, options });
      promises.push(makeInternalHttpRequest(chuckedData, options));
    }
    const results = await Promise.allSettled(promises);
    const erros = [];
    results.forEach((el) => {
      if (el.status !== 'fulfilled') {
        erros.push(el);
      }
    });
    if (erros.length) {
      throw erros;
    }

    return results.map((result) => result.value);
  }

  async isActiveMechanism() {
    try {
      const query = `select true ext_exists from pg_extension where extname = 'pg_store_plans';`;
      const { rows } = await this.dbClient.query(query);
      this.logger.debug('isActiveMechanism', { pg_store: rows });
      return rows?.[0]?.ext_exists === true;
    } catch (e) {
      return false;
    }
  }

  async run({ dbConfig, client }) {
    this.dbConfig = dbConfig;
    this.dbClient = client;
    if (await this.isActiveMechanism()) {
      const rowsFetched = await this.fetchData();
      this.logger.debug('run - calling shapeData rowsFetched: ', rowsFetched);
      const results = this.shapeData(rowsFetched);
      this.logger.debug('run - calling transferData with: ', results);
      return results;
    }
  }
}

const planCollector = new PlanCollector();

module.exports = {
  planCollector: {
    fn: planCollector.run.bind(planCollector),
    exporter: {
      sendResults: planCollector.transferData.bind(planCollector),
    },
  },
};