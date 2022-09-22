Developing locally
==================

- To run the collector:
  * cd to the `src` directory
  * Set the enviroment variables as desribed in the `.env.dev` file
  * Run `node metrix.js`.
- The collector has a stress test that simulates collection from 100 clients simultaneously. In order to run it;
  * First make sure that you have enough API Keys. For that run `list-all-api-keys.sh`.
  * If you don't have API Keys, run `create-api-keys.sh` and save its output to a .csv file. Then upload this CSV to the AWS gateway (see the link inside this script)
  * Later these keys can be deleted by running the `delete-all-api-key.sh`.
- The stress test can be run by running the `stress_test.sh` script.

Simulator
==================
- The collector also can be run in a mode that "simulates" data. For example, in order to fake data of that last 30 days run
  * `npm run simulator`

Env params
==================
- DATADOG_API_KEY
- SENTRY_DSN
- API_KEY
- API_GATEWAY_HOST
- API_GATEWAY_PORT
- API_GATEWAY_PATH
- DB_CONNECTION_STRINGS
- QUERIES_FILE
- IGNORE_CURRENT_TIME
- IGNORE_WINSTON_CONSOLE
