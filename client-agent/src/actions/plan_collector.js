const { makeInternalHttpRequest } = require('../http');
const { createSubLogger } = require('../logging');
const makeSpan = require('../utilities/span-utility');
const chuncker = require('../utilities/chunck-utility');

class PlanCollector {
  logger;

  constructor() {
    this.logger = createSubLogger(this.constructor.name);
  }

  async fetchData({ dbConfig, client }) {
    const query = `
            set pg_store_plans.plan_format = 'json';

select query, plan, last_call, B.mean_time as duration, A.queryid as query_id from pg_stat_statements A 
join pg_store_plans B on A.queryid = B.queryid
join pg_database C on B.dbid = C.oid
where 1=1
and datname = '${dbConfig.database}'
and last_call >= NOW() - interval '1h'
;`;

    this.logger.debug('fetchData - calling dbClient.query with: ', query);
    const [_, { rows }] = await client.query(query);
    return rows;
  }

  shapeData({ dbConfig, data }) {
    try {
      return data.map((el) => makeSpan({ message: { ...el, plan: el?.plan }, ...dbConfig }));
    } catch (e) {
      this.logger.error('shapeData - error: ', e);
    }
  }

  async transferData({ payload, options }) {
    const { data = [] } = payload;
    const promises = [];
    for (let chuckedData of chuncker(data?.map((el) => JSON.stringify(el)))) {
      this.logger.debug('transferData - calling makeInternalHttpRequest: ', {
        chuckedData,
        options,
      });
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

  async run({ dbConfig, client }) {
    const query = `SELECT count(*) as counter FROM pg_extension WHERE extname = 'pg_store_plans';`;
    const result = await client.query(query);
    if (result?.rows[0]?.counter === '0') {
      this.logger.info("pg_store_plans isn't installed");
      return [];
    }
    const rowsFetched = await this.fetchData({ dbConfig, client });

    return this.shapeData({ dbConfig, client, data: rowsFetched });
  }
}

const planCollector = new PlanCollector();

module.exports = {
  PlanCollector,
  planCollector: {
    fn: planCollector.run.bind(planCollector),
    exporter: {
      sendResults: planCollector.transferData.bind(planCollector),
    },
  },
};
