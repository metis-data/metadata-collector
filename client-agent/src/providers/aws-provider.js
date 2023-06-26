const aws = require('aws-sdk');
const { AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID } = require('../consts');
const { createSubLogger } = require('../logging');

const logger = createSubLogger('AwsProvider');

class AwsProvider {
    _aws = aws;

    constructor() {
        if (!AWS_REGION) {
            logger.error('AWS_REGION is not provided');
            return;
        }
        else if (!AWS_SECRET_ACCESS_KEY) {
            logger.error('AWS_SECRET_ACCESS_KEY is not provided');
            return;
        }
        else if (!AWS_ACCESS_KEY_ID) {
            logger.error('AWS_ACCESS_KEY_ID is not provided');
            return;
        }
        else {
            this._aws.config.update({
                region: AWS_REGION, credentials: {
                    secretAccessKey: AWS_SECRET_ACCESS_KEY,
                    accessKeyId: AWS_ACCESS_KEY_ID
                }
            })
        }
    }

    async getDbHostMetadata(DBInstanceIdentifier) {
        return new Promise((resolve, rej) => {
            new this._aws.RDS().describeDBInstances({ DBInstanceIdentifier }, (err, descData) => {
                if (err) return rej(err);
                else {
                    const results = {};
                    const dbInstance = descData.DBInstances[0];
                    const { Engine, EngineVersion, Endpoint: { Address }, InstanceCreateTime } = dbInstance;
                    results.server = Address;
                    results.engine = Engine;
                    results.engineVersion = EngineVersion
                    results.instanceUpTime = {
                        value: parseInt((new Date().getTime() - new Date(InstanceCreateTime).getTime()) / (1000 * 60 * 60)),
                        unit: 'M'
                    };
                    const instanceClass = dbInstance?.DBInstanceClass?.split?.('.').slice?.(-2).join?.('.');

                    new this._aws.EC2().describeInstanceTypes({
                        InstanceTypes: [instanceClass]
                    }, (err, data) => {
                        if (err) return rej(err);
                        const { MemoryInfo: { SizeInMiB: memory }, VCpuInfo: { DefaultCores: cpuCores } } = data?.InstanceTypes?.[0];
                        results.cpu = cpuCores;
                        results.memory = {
                            value: parseInt(memory / 1024),
                            unit: 'GB'
                        };
                        return resolve(results);
                    });
                }
            });
        });
    }
}

module.exports = AwsProvider;