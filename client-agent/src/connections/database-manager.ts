import { promisify } from 'util';
import { parsePostgresConnection, getConnectionStrings } from './utils';
import { Pool } from 'pg';
import { createSubLogger } from '../logging';
const logger = createSubLogger('database-manager');
const MetisSqlCollector = require('@metis-data/slow-query-log').MetisSqlCollector;
const consts = require('../consts');

const getHttpProtocol = (port: number) => {
  const HTTP = 'http://';
  const HTTPS = 'https://';

  return port === 443 ? HTTPS : port === 80 ? HTTP : null;
};

export class Database {
  connectionString: any;
  pool: any;
  dbConfig: any;
  poolEndFnAsync: any;
 
  constructor(connectionString: any) {
    this.connectionString = this._addApplicationName(connectionString);
  }

  _addApplicationName(connectionString: any) {
    const parsedConnectionString = new URL(connectionString);
    parsedConnectionString.searchParams.set('application_name', 'MMC');
    const modifiedConnectionString = parsedConnectionString.toString();
    return modifiedConnectionString;
  }

  async connect() {
    throw new Error('Method not implemented');
  }

  async query(sql: any, values: any) {
    throw new Error('Method not implemented');
  }

  async close() {
    throw new Error('Method not implemented');
  }
}

export class PostgresDatabase extends Database {
  static provider = 'postgres';
  database: any;
  metisSqlCollector: any;
  
  constructor(connectionString: any) {
    super(connectionString);
    this._state = {
      _isSlowQueryLogReady: false,
    };

    this.pool = new Pool({ connectionString: this.connectionString });

    const { password, ...sanitizedConfig } = parsePostgresConnection(connectionString);
    this.dbConfig = sanitizedConfig;
    this.poolEndFnAsync = promisify(this.pool.end).bind(this.pool);

    Object.freeze(this.dbConfig);
    Object.assign(this, this.dbConfig);
    this._initSlowQueryLog(connectionString);
    Object.freeze(this);
  }

  _initSlowQueryLog(connectionString: string) {
    const metisApiKey = consts.API_KEY;
    const metisExportUrl = new URL(getHttpProtocol(consts.API_GATEWAY_PORT) + consts.API_GATEWAY_HOST)
      .href;
    // TODO: think about a service name convention
    const serviceName = `${this.database}-pmc`;

    logger.debug('takeAction - calling new MetisSqlCollector');
    const _logger = createSubLogger('MetisSqlCollector');
    this._metisSqlCollector = new MetisSqlCollector({
      connectionString,
      metisApiKey,
      metisExportUrl,
      serviceName,
      dbName: this.database,
      byTrace: false,
      autoRun: false,
      logger: _logger,
      debug: consts.isDebug(),
    });
  }

  toJSON() {
    return this.dbConfig;
  }

  async connect() {
    try {
      const client = await this.pool.connect();
      logger.debug(`connected to ${JSON.stringify(this)}`);
      return client;
    } catch (error) {
      logger.error('Error connecting to PostgreSQL:', error);
      throw error;
    }
  }

  async collectSpansFromSlowQueryLog() {
    for await (const client of this.clientGenerator()) {
      if (!this._state._isSlowQueryLogReady) {
        await this._metisSqlCollector.setup(client);
        this._state._isSlowQueryLogReady = true;
      }

      await this._metisSqlCollector.run(client);
    }
  }

  async *clientGenerator() {
    const client = await this.connect();
    try {
      yield client;
    } finally {
      client?.release();
    }
  }

  async query(sql: any, values: any) {
    const client = await this.connect();
    if (!client) {
      throw new Error('Couldnt establish a connection');
    }

    try {
      return await client.query(sql, values);
    } finally {
      client?.release();
    }
  }

  async close() {
    try {
      await this.poolEndFnAsync();
      logger.debug('Pool has been closed.');
    } catch (error) {
      logger.error('Error closing pool:', error);
    }
  }
}

export class DatabaseConnectionsManager {
  static instance: any;
  connections: any;
  constructor() {
    this.connections = new Map();
    DatabaseConnectionsManager.instance = this;
  }

  static async create() {
    if (DatabaseConnectionsManager.instance) {
      return DatabaseConnectionsManager.instance;
    }
    const databaseConnectionsManager = new DatabaseConnectionsManager();
    const dbConnectionStrings = (await getConnectionStrings()).split(';').filter(Boolean);

    dbConnectionStrings.forEach((connectionString: any) => {
      databaseConnectionsManager.createDatabaseManager(connectionString);
    });

    return databaseConnectionsManager;
  }

  createDatabaseManager(connectionString: any) {
    if (this.connections.has(connectionString)) {
      return this.connections.get(connectionString);
    }

    // TODO: Factory
    const databaseManager = new PostgresDatabase(connectionString);

    this.connections.set(connectionString, databaseManager);
    return databaseManager;
  }

  getDatabases() {
    return Array.from(this.connections.values());
  }

  map(callback: any) {
    const result = [];
    const databases = this.getDatabases();
    for (let i = 0; i < databases.length; i++) {
      result.push(callback(databases[i], i, databases));
    }
    return result;
  }

  async closeAllConnections() {
     await Promise.allSettled(
      this.getDatabases().map(async (databaseManager: any) => await databaseManager.close()),
      //Todo: log if some of the connection couldnt be close
    );
    this.connections.clear();
  }
}

