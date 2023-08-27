# Developing locally

- To run the collector:
  - cd to the `src` directory
  - Set the enviroment variables as desribed in the `.env.dev` file
  - Run `node metrix.js`.
- The collector has a stress test that simulates collection from 100 clients simultaneously. In order to run it;
  - First make sure that you have enough API Keys. For that run `list-all-api-keys.sh`.
  - If you don't have API Keys, run `create-api-keys.sh` and save its output to a .csv file. Then upload this CSV to the AWS gateway (see the link inside this script)
  - Later these keys can be deleted by running the `delete-all-api-key.sh`.
- The stress test can be run by running the `stress_test.sh` script.

# Simulator

- The collector also can be run in a mode that "simulates" data. For example, in order to fake data of that last 30 days run
  - `npm run simulator`

# Env params

- DATADOG_API_KEY - Logs are sent to Datadog logs service. Key can be seen or created here https://app.datadoghq.com/organization-settings/api-keys
- SENTRY_DSN - The Senty URI
- API_KEY - Metis AWS API Gateway key
- API_GATEWAY_HOST - The AWS Host URL
- API_GATEWAY_PORT - The port number (default 443)
- API_GATEWAY_PATH - The AWS API Gateway path
- DB_CONNECTION_STRINGS - Connection strings of the database seperated by ";" between databases.
- QUERIES_FILE - The YAML file that describes the queries to be run (default [queries.yaml](src/queries.yaml)).
- IGNORE_WINSTON_CONSOLE - If "true" ignore Winston console logger. Log to stdout in a readable non-JSON format.
