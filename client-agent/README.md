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
