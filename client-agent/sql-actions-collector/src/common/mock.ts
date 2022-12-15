
import { setup } from './setup';
import { logger } from './logging';
import { processResults } from './process';
import { API_KEY } from './consts';
const MAX_NUMBER_OF_MOCK_TABLES = 100;

function sumAscii(s) {
  return s.split('').map((c) => c.charCodeAt(0)).reduce((a, b) => a + b, 0);
}

function randomNatural(n) {
  return Math.floor(Math.random() * n) + 1;
}

function generateMockResults(queriesNumParams) {
  const results = [];
  for (let i = 0; i < queriesNumParams.length; i += 1) {
    const userID = API_KEY;
    const schemaName = `Schema:${userID.substring(0, 8)}`;
    const numTables = (sumAscii(userID) % MAX_NUMBER_OF_MOCK_TABLES) + 1;

    const rows = [];
    for (let j = 0; j < numTables; j += 1) {
      const row = {
        schema: schemaName, table: `Table:${userID.substring(8, 16)}#${j}`,
      };
      for (let k = 0; k < queriesNumParams[i]; k += 1) {
        const n = randomNatural(20);
        row[`Value${k}`] = randomNatural(n * n * n);
      }
      rows.push(row);
    }
    results.push({ rows });
  }
  return results;
}

async function mockCollect() {
  try {
    const queriesNumParams = [4, 6];
    logger.info('Getting Mock results');
    const results = generateMockResults(queriesNumParams);
    logger.info('Got Mock results. Sending the results ...');
    await processResults({ database: `Database:${(API_KEY as any).split(4, 10)}`, host: 'mock.host.com' }, results, new Date().getTime(), 0);
    logger.info('Sending result done.');
  } catch (err: any) {
    logger.error(err.message);
  }
  logger.info(' Collection is done.');
}

const runMock = async () => {
  const ok: any = await setup();
  if (!ok) {
    return;
  }

  mockCollect();
}

runMock().then(() => {}).catch((err) => { logger.error(err.message); });
