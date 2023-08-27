import aws = require('aws-sdk');
import { createSubLogger } from '../../logging';
const logger = createSubLogger('AwsRdsResource');
import { API_KEY, METIS_AWS_REGION as region, METIS_AWS_ACCESS_KEY_ID as access_key_id, METIS_AWS_SECRET_ACCESS_KEY as secret_access_key } from '../../consts';

export class AwsRdsResource {
  #cloudwatch: any;
  valid: any;
  region: any;
  secret_access_key: any;
  access_key_id: any;
  instanceId: any;
  metrics: any;

  #init() {
    this.valid = true;

    this.#cloudwatch = new aws.CloudWatch({
      region: this.region,
      credentials: {
        secretAccessKey: this.secret_access_key,
        accessKeyId: this.access_key_id,
      },
    });
  }

  constructor(instance_id: any, metrics: any) {
    this.valid = false;
    if (!instance_id) {
      logger.info('instanceId is not provided');
      return;
    } else if (!access_key_id) {
      logger.warn('access_key_id is not provided');
      return;
    } else if (!secret_access_key) {
      logger.warn('secret_access_key is not provided');
      return;
    } else if (!region) {
      logger.warn('region is not provided');
      return;
    } else {
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
    Statistics: ['Average'],
  };

  #fetch() {
    if (!this.valid) {
      throw new Error('Cannot fetch rds data');
    }

    return this.metrics.map((el: any) => {
      const { measurement, ...rest } = el;
      return new Promise((resolve, reject) => {
        this.#cloudwatch.getMetricStatistics(
          {
            ...this.#params,
            Dimensions: [
              {
                Name: 'DBInstanceIdentifier',
                Value: this.instanceId,
              },
            ],
            ...rest,
          },
          function (err: any, data: any) {
            if (err) {
              return reject({ ...err, measurement });
            } else {
              return resolve({ ...data, measurement });
            }
          },
        );
      });
    });
  }

  normalize(data: any) {
    const results = data.map((el: any) => {
      const { Datapoints, db, host, apiKey, measurement } = el;
      const _data = Datapoints?.map((el: any) => {
        const { Average, Timestamp, Unit } = el;
        const tags = {
          unit: Unit,
          db,
          host,
          apiKey,
        };
        const metricName = measurement;
        const timestamp = new Date(Timestamp).getTime() * 1000000;
        const value = Average;
        return {
          metricName,
          tags,
          timestamp,
          value,
        };
      });
      return _data;
    });
    return results?.flat?.(Infinity);
  }

  async collect(connections: any) {
    if (!this.valid) {
      throw new Error('Cannot fetch rds data');
    }

    const results = await Promise.allSettled(
      connections.map(async (connection: any) => {
        // PostgresDatabase class
        const { database: db, host, port } = connection.dbConfig;
        const query = this.#fetch();
        const promiseArr = await Promise.allSettled(query);
        return promiseArr.map((el) => {
          if (el.status === 'rejected') {
            throw el.reason;
          } else {
            return { ...el.value, db, host, port, apiKey: API_KEY };
          }
        });
      }),
    );

    // TODO: all rejected fetch items should be logged!
    const data = results
      ?.filter((prom: any) => prom.status === 'fulfilled')
      .map((prom: any) => prom.value)
      .flat(Infinity);
    return data;
  }
}


