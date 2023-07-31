const { promisify } = require('util');
const { parsePostgresConnection, getConnectionStrings } = require('./utils');
const { Pool } = require('pg');
const { createSubLogger } = require('../logging');
const logger = createSubLogger('database-manager');

class Database {
  constructor(connectionString) {
    this.connectionString = this._addApplicationName(connectionString);
  }

  _addApplicationName(connectionString) {
    const parsedConnectionString = new URL(connectionString);
    parsedConnectionString.searchParams.set('application_name', 'MMC');
    const modifiedConnectionString = parsedConnectionString.toString();
    return modifiedConnectionString;
  }

  async connect() {
    throw new Error('Method not implemented');
  }

  async query(sql, values) {
    throw new Error('Method not implemented');
  }

  async close() {
    throw new Error('Method not implemented');
  }
}

class PostgresDatabase extends Database {
  static provider = 'postgres';

  constructor(connectionString) {
    super(connectionString);

    this.pool = new Pool({ connectionString: this.connectionString });

    const { password, ...sanitizedConfig } = parsePostgresConnection(connectionString);
    this.dbConfig = sanitizedConfig;
    this.poolEndFnAsync = promisify(this.pool.end).bind(this.pool);
    Object.freeze(this.dbConfig);
    Object.assign(this, this.dbConfig);
    Object.freeze(this);
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

  async *clientGenerator() {
    const client = await this.connect();
    try {
      yield client;
    } finally {
      client?.release();
    }
  }

  async query(sql, values) {
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

class DatabaseConnectionsManager {
  static instance;
  constructor() {
    if (DatabaseConnectionsManager.instance) {
      return DatabaseConnectionsManager.instance;
    }

    this.connections = new Map();
    DatabaseConnectionsManager.instance = this;
  }

  static async create() {
    const databaseConnectionsManager = new DatabaseConnectionsManager();
    const dbConnectionStrings = (await getConnectionStrings()).split(';').filter(Boolean);

    dbConnectionStrings.forEach((connectionString) => {
      databaseConnectionsManager.createDatabaseManager(connectionString);
    });

    return databaseConnectionsManager;
  }

  createDatabaseManager(connectionString) {
    if (this.connections.has(connectionString)) {
      return this.connections.get(connectionString);
    }

    const databaseManager = new PostgresDatabase(connectionString);
    this.connections.set(connectionString, databaseManager);
    return databaseManager;
  }

  getDatabases() {
    return Array.from(this.connections.values());
  }

  map(callback) {
    const result = [];
    const databases = this.getDatabases();
    for (let i = 0; i < databases.length; i++) {
      result.push(callback(databases[i], i, databases));
    }
    return result;
  }

  async closeAllConnections() {
    const result = await Promise.allSettled(
      this.getDatabases().map(async (databaseManager) => await databaseManager.close()),
      // todo: log if some of the connection couldnt be close
    );
    this.connections.clear();
  }
}

module.exports = DatabaseConnectionsManager;
