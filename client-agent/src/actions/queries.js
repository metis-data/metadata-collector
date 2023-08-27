const fs = require('fs');

const { createSubLogger } = require('../logging');
logger = createSubLogger('queries');
const { makeInternalHttpRequest } = require('../http');

const { randomUUID } = require('crypto');
const { COLLECTOR_VERSION, TAGS, QUERIES_FILE, HTTPS_REQUEST_OPTIONS } = require('../consts');
const yaml = require('js-yaml');

const queriesFileContents = fs.readFileSync(QUERIES_FILE, 'utf8');
const QUERIES = yaml.load(queriesFileContents);

// databaseConnection: PostgresDatabase
async function shapeData(dbConfig, rows) {
  const timestamp = new Date().getTime();

  const metricsData = [];
  rows.forEach((row) => {
    const valueNames = Object.keys(row).filter((key) => !TAGS.has(key));
    valueNames.forEach((valueName) => {
      const r = {};
      r.id = randomUUID();
      r.timestamp = timestamp;
      r.metricName = valueName;
      r.value = parseFloat(row[valueName]);
 
      TAGS.forEach((tag) => {
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

const run = (query) => async ({ dbConfig, client }) => {
    logger.debug('run - calling fetchData with: ', dbConfig);
    const res = await client.query(query);
    const results = await shapeData(
      dbConfig,
      res.rows,
    );
    logger.info('Processing results done.', { dbConfig });

    return results;
};

const sendResults = async ({ payload, options }) => {
  const { data: _data } = payload;
  const data = _data.flat(Infinity);
  logger.debug('sendResults - calling makeInternalHttpRequest: ', { options });
  return makeInternalHttpRequest(data, HTTPS_REQUEST_OPTIONS);
}

const actions = Object.keys(QUERIES).reduce((actions, queryName) =>{
  actions[queryName] = {
    fn: run(QUERIES[queryName]),
    exporter: {
      sendResults,
    },
  };
  return actions;
}, {});

module.exports = actions;
