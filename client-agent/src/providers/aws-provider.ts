const aws = require('aws-sdk');
const { METIS_AWS_REGION, METIS_AWS_SECRET_ACCESS_KEY, METIS_AWS_ACCESS_KEY_ID } = require('../consts');
const { createSubLogger } = require('../logging');

const logger = createSubLogger('AwsProvider');

class AwsProvider {
    _aws = aws;

    constructor() {
        if (!METIS_AWS_REGION) {
            logger.error('METIS_AWS_REGION is not provided');
            return;
        }
        else if (!METIS_AWS_SECRET_ACCESS_KEY) {
            logger.error('METIS_AWS_SECRET_ACCESS_KEY is not provided');
            return;
        }
        else if (!METIS_AWS_ACCESS_KEY_ID) {
            logger.error('METIS_AWS_ACCESS_KEY_ID is not provided');
            return;
        }
        else {
            this._aws.config.update({
                region: METIS_AWS_REGION, credentials: {
                    secretAccessKey: METIS_AWS_SECRET_ACCESS_KEY,
                    accessKeyId: METIS_AWS_ACCESS_KEY_ID
                }
            })
        }
    }

    async getDbHostMetadata(DBInstanceIdentifier: any) {
        return new Promise((resolve, rej) => {
            new this._aws.RDS().describeDBInstances({ DBInstanceIdentifier }, (err: any, descData: any): any => {
                if (err) return rej(err);
                else {
                    const results: any = {};
                    const dbInstance: any = descData.DBInstances[0];
                    const { Engine, EngineVersion, Endpoint: { Address }, InstanceCreateTime }: any = dbInstance;
                    results.server = Address;
                    results.engine = Engine;
                    results.engineVersion = EngineVersion;
                    
                    results.instanceUpTime = {
                        value: Math.round((new Date().getTime() - new Date(InstanceCreateTime).getTime()) / (1000 * 60 * 60)),
                        unit: 'M'
                    };
                    const instanceClass = dbInstance?.DBInstanceClass?.split?.('.').slice?.(-2).join?.('.');

                    new this._aws.EC2().describeInstanceTypes({
                        InstanceTypes: [instanceClass]
                    }, (err: any, data: any) => {
                        if (err) return rej(err);
                        const { MemoryInfo: { SizeInMiB: memory }, VCpuInfo: { DefaultCores: cpuCores } } = data?.InstanceTypes?.[0];
                        results.cpu = cpuCores;
                        results.memory = {
                            value: Math.round(memory / 1024),
                            unit: 'GB'
                        };
                        return resolve(results);
                    });
                }
            });
        });
    }
}

export default AwsProvider;