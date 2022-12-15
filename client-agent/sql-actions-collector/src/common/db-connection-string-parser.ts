/*
name: Gideon Shmila

description: 
dbConnectionStringParser get a string of one connection string or more separated by ';'
and return array of connection object from that pattern 
      {
      connectionTimeoutMillis:number
      database:string
      host:string
      password:string
      port:string'
      user:string
      }
*/

var parse = require('pg-connection-string').parse;

const dbConnectionStringParser = (connectionsString: string, connectionTimeoutMillis: number): any[] => {
  try {
    return connectionsString.split(';').map((connectionString: string) => {
      return { ...parse(connectionString), connectionTimeoutMillis };
    });
  } catch (error) {
    console.log(error);
    return null
  }
};

export default dbConnectionStringParser;
