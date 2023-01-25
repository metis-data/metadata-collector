const pg = require('pg');
const { logger } = require('../logging');

const stat_statements = async (dbConfig) => {
    try {
        const client = new pg.Client(dbConfig);
        logger.info(`Trying to connect to ${dbConfig.database} ...`);
        await client.connect();
        logger.info(`Connected to ${dbConfig.database}`);
        const query = `select 
pgss.queryid as query_id,
pgss.query,
pgss.calls,
pgss.rows,
pgss.total_exec_time,
pgss.mean_exec_time,
pgss.dbid as db_id,
blk_read_time + blk_write_time as disk_io_time,
json_build_object(
'jit_emission_time', pgss.jit_emission_time,
'toplevel', pgss.toplevel,
'userid', pgss.userid,
'plans', pgss.plans,
'total_plan_time', pgss.total_plan_time,
'min_plan_time', pgss.min_plan_time,
'max_plan_time', pgss.max_plan_time,
'mean_plan_time', pgss.mean_plan_time,
'stddev_plan_time', pgss.stddev_plan_time,
'min_exec_time', pgss.min_exec_time,
'max_exec_time', pgss.max_exec_time,
'stddev_exec_time', pgss.stddev_exec_time,
'shared_blks_hit', pgss.shared_blks_hit,
'shared_blks_read', pgss.shared_blks_read,
'shared_blks_dirtied', pgss.shared_blks_dirtied,
'shared_blks_written', pgss.shared_blks_written,
'local_blks_hit', pgss.local_blks_hit,
'local_blks_read', pgss.local_blks_read,
'local_blks_dirtied', pgss.local_blks_dirtied,
'local_blks_written', pgss.local_blks_written,
'temp_blks_read', pgss.temp_blks_read,
'temp_blks_written', pgss.temp_blks_written,
'blk_read_time', pgss.blk_read_time,
'blk_write_time', pgss.blk_write_time,
'temp_blk_read_time', pgss.temp_blk_read_time,
'temp_blk_write_time', pgss.temp_blk_write_time,
'wal_records', pgss.wal_records,
'wal_fpi', pgss.wal_fpi,
'wal_bytes', pgss.wal_bytes,
'jit_functions', pgss.jit_functions,
'jit_generation_time', pgss.jit_generation_time,
'jit_inlining_count', pgss.jit_inlining_count,
'jit_inlining_time', pgss.jit_inlining_time,
'jit_optimization_count', pgss.jit_optimization_count,
'jit_optimization_time', pgss.jit_optimization_time,
'jit_emission_count', pgss.jit_emission_count,
'datacl', d.datacl,
'datconnlimit', d.datconnlimit,
'datfrozenxid', d.datfrozenxid,
'datminmxid', d.datminmxid,
'dattablespace', d.dattablespace,
'oid', d.oid,
'datdba', d.datdba,
'encoding', d.encoding,
'datlocprovider', d.datlocprovider,
'datistemplate', d.datistemplate,
'datallowconn', d.datallowconn,
'datname', d.datname,
'datcollversion', d.datcollversion,
'datcollate', d.datcollate
--'datctype', d.datctype,
--'daticulocale', d.daticulocale
) as metadata
from pg_stat_statements as pgss
join pg_database as d  on pgss.dbid = d.oid
 order by pgss.calls DESC LIMIT 5000;`;
        const { rows } = await client.query(query);
        return rows;
    }
    catch (e) {
        console.error(e);
        throw e;
    }
}

module.exports = stat_statements;