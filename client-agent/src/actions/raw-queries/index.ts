
export const availableExtensionsQuery = `SELECT name, default_version, installed_version, comment 
FROM pg_available_extensions 
ORDER BY name`;

export const connectionsQuery = `SELECT state, count(*)::int FROM pg_stat_activity
where datid is not null
group by state;`;

export const pgstatstatmentsQuery = (databaseName: string, limit: number) => `
SELECT table_catalog, table_schema, table_name from information_schema.tables WHERE table_schema NOT IN('pg_catalog', 'information_schema');

select 
queryid as query_id,
pgss.calls as calls,
query,
pgss.rows,
pgss.total_exec_time,
pgss.mean_exec_time,
pgss.dbid as db_id,
pgd.datname as database_name,
blk_read_time + blk_write_time as disk_io_time,
to_jsonb(pgss) - 'userId' - 'dbid' - 'mean_exec_time' - 'total_exec_time' - 'rows' - 'query' - 'queryid' - 'calls' as metadata
from pg_stat_statements as pgss
join pg_database pgd on pgd.oid = pgss.dbid
where 
1=1
and rows > 0 
and total_exec_time > 0
and pgd.datname = '${databaseName}'
order by total_exec_time desc, calls desc 
limit ${limit};`




