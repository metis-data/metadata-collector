const pg = require('pg');
const { logger } = require('../logging');

const available_extensions = async (dbConfig) => {
    let client;
    try {
        client = new pg.Client(dbConfig);
        logger.info(`Trying to connect to ${dbConfig.database} ...`);
        await client.connect();
        logger.info(`Connected to ${dbConfig.database}`);
        const query = `SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
ORDER BY name`;
        const { rows } = await client.query(query);
        return rows;
    }
    catch (e) {
        logger.error(e);
    }
    finally {
        try {
            await client.end();
            logger.info(`connection has been closed.`);
        }
        catch (e) {
            logger.error(`connection could not be closed: `, e);
        }
    }
}

module.exports = available_extensions;