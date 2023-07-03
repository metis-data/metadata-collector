const aws = require('aws-sdk');
const { createSubLogger } = require('../../logging');
const logger = createSubLogger('AwsRdsResource');
const { API_KEY, METIS_AWS_REGION: region, METIS_AWS_ACCESS_KEY_ID: access_key_id, METIS_AWS_SECRET_ACCESS_KEY: secret_access_key } = require('../../consts');

class AwsRdsResource {
    #cloudwatch;

    #init() {
        this.#cloudwatch = new aws.CloudWatch({
            region: this.region,
            credentials: {
                secretAccessKey: this.secret_access_key,
                accessKeyId: this.access_key_id
            }
        });
    }

    constructor(instance_id, metrics) {
        if (!instance_id) {
            logger.error('instanceId is not provided');
            return;
        }
        else if (!access_key_id) {
            logger.error('access_key_id is not provided');
            return;
        }
        else if (!secret_access_key) {
            logger.error('secret_access_key is not provided');
            return;
        }
        else if (!region) {
            logger.error('region is not provided');
            return;
        }
        else {
            this.region = region;
            this.instanceId = instance_id;
            this.access_key_id = access_key_id;
            this.secret_access_key = secret_access_key;
            this.metrics = metrics;
            this.#init();
        }
    }

    #params = {
        Namespace: 'AWS/RDS',
        StartTime: new Date(Date.now() - 60 * 1000 * 60 * 1),
        EndTime: new Date(),
        Period: 60,
        Statistics: ['Average']
    };

    #fetch() {
        return this.metrics.map(el => {
            const { measurement, ...rest } = el;
            return new Promise((resolve, reject) => {
                this.#cloudwatch.getMetricStatistics({
                    ...this.#params, Dimensions: [
                        {
                            Name: 'DBInstanceIdentifier',
                            Value: this.instanceId
                        }
                    ], ...rest
                }, function (err, data) {
                    if (err) {
                        return reject({ ...err, measurement });
                    } else {
                        return resolve({ ...data, measurement });
                    }
                });
            });
        });
    }

    normalize(data) {
        const results = data.map(el => {
            const { Datapoints, Label, db, host, apiKey, measurement } = el;
            const _data = Datapoints?.map(el => {
                const { Average, Timestamp, Unit } = el;
                const tags = {
                    unit: Unit,
                    db, host, apiKey
                };
                const metricName = measurement;
                const timestamp = new Date(Timestamp).getTime() * 1000000;
                const value = Average;
                return {
                    metricName,
                    tags,
                    timestamp,
                    value
                }
            });
            return _data;
        });
        return results?.flat?.(Infinity);
    }

    async collect(dbConfigs) {
        logger.info('collect - start');
        try {
            const results = await Promise.allSettled(dbConfigs.map(async dbConfig => {
                const { database: db, host } = dbConfig;
                const query = this.#fetch();
                const promiseArr = await Promise.allSettled(query);
                const data = promiseArr.map(el => el.status === 'fulfilled' ? { ...el.value, db, host, apiKey: API_KEY } : {});
                return data;
            }));
            const data = results.map((prom) => prom.status === 'fulfilled' ? prom.value : [])?.flat(Infinity);
            logger.debug('collect - data: ', data);
            logger.info('collect - end');
            return data;
        }
        catch (e) {
            logger.err('collect - error:', e);
            throw e;
        }
    }
}

module.exports = AwsRdsResource;