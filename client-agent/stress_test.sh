#!/bin/bash

export SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
export COLLECTOR_DIRECTORY=$SCRIPT_DIR/src
export NUMBER_OF_STRESS_TEST_PROCESSES=${1:-10}
export API_KEYS=`aws apigateway get-api-keys --name-query mdc-stress-test --include-values | jq -r '.items | .[].value' | head -$NUMBER_OF_STRESS_TEST_PROCESSES`

pushd .
cd $COLLECTOR_DIRECTORY

for api_key in $API_KEYS; do
    echo Running with API Key $api_key
    API_KEY="$api_key" API_GATEWAY_HOST="https://ingest.metisdata.io" \
    API_GATEWAY_PORT="443" API_GATEWAY_PATH="/md-collector" node mock.js &
done

echo Waiting for everything to complete ...
while : ; do
    num_children=$(pgrep -c -P$$)
    echo $num_children processes are left ...
    [[ $num_children > 0 ]] || break
    sleep 1
done

unset API_KEYS COLLECTOR_DIRECTORY NUMBER_OF_STRESS_TEST_PROCESSES

popd

echo All processes are done\!\!\!
