const fs = require('fs');
import { createSubLogger } from'../logging';

const logger = createSubLogger('queries');
const { makeInternalHttpRequest } = require('../http');

const { randomUUID } = require('crypto');
const { COLLECTOR_VERSION, TAGS, QUERIES_FILE, HTTPS_REQUEST_OPTIONS } = require('../consts');
const yaml = require('js-yaml');

const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES = yaml.load(queriesFileContents);

// databaseConnection: PostgresDatabase
async function shapeData(dbConfig: any, rows: any) {
  const timestamp = new Date().getTime();

  const metricsData: any = [];
  rows.forEach((row: any) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r: any = {};
      r.id = randomUUID();
      r.timestamp = timestamp;
      r.metricName = valueName;
      r.value = parseFloat(row[valueName]);
 
      TAGS.forEach((tag: any) => {
        if (row[tag]) r[tag] = row[tag];
      });
      r.db = dbConfig.database;
      r.host = dbConfig.host;
      r.version = COLLECTOR_VERSION;
      metricsData.push(r);
    });
  });

  return metricsData;
}

const run = (query: any) => async ({ dbConfig, client }: any) => {
    logger.debug('run - calling fetchData with: ', dbConfig);
    const res = await client.query(query);
    const results = await shapeData(
      dbConfig,
      res.rows,
    );
    logger.info('Processing results done.', { dbConfig });

    return results;
};

const sendResults = async ({ payload, options }: any) => {
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', { options });
  return makeInternalHttpRequest(data, HTTPS_REQUEST_OPTIONS);
}

const actions = Object.keys(QUERIES).reduce((actions: any, queryName: any) =>{
  actions[queryName] = {
    fn: run(QUERIES[queryName]),
    exporter: {
      sendResults,
    },
  };
  return actions;
}, {});

export default actions;
