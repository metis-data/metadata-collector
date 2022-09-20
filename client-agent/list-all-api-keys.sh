#!/bin/bash
# This script assumes the key were genereted using the create-api-keys-csv.sh script
aws apigateway get-api-keys --name-query mdc-stress-test | jq -r '.items | .[].id' 
