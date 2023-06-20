const { CloudProvider } = require("../../models");

const METRIC_PROVIDER_MAPPER = {
    CPU_UTILIZATION: {
        [CloudProvider.AWS]: {
            MetricName: 'CPUUtilization', Unit: 'Percent'
        }
    },
    DATABASE_CONNECTIONS: {
        [CloudProvider.AWS]: { MetricName: 'DatabaseConnections', Unit: 'Count' }
    },
    FREE_STORAGE_SPACE: {
        [CloudProvider.AWS]: { MetricName: 'FreeStorageSpace', Unit: 'Bytes' }
    },
    FREEABLE_MEMORY: {
        [CloudProvider.AWS]: { MetricName: 'FreeableMemory', Unit: 'Bytes' },
    },
    READ_LATENCY: {
        [CloudProvider.AWS]: { MetricName: 'ReadLatency', Unit: 'Seconds', },
    },
    READ_THROUGHPUT: {
        [CloudProvider.AWS]: { MetricName: 'ReadThroughput', Unit: 'Bytes/Second' },
    },
    READ_IOPS: {
        [CloudProvider.AWS]: { MetricName: 'ReadIOPS', Unit: 'Count/Second' },
    },
    WRITE_LATENCY: {
        [CloudProvider.AWS]: { MetricName: 'WriteLatency', Unit: 'Seconds' },
    },
    WRITE_THROUGHPUT: {
        [CloudProvider.AWS]: { MetricName: 'WriteThroughput', Unit: 'Bytes/Second' },
    },
    WRITE_IOPS: {
        [CloudProvider.AWS]: { MetricName: 'WriteIOPS', Unit: 'Count/Second' }
    }
}

module.exports = METRIC_PROVIDER_MAPPER;