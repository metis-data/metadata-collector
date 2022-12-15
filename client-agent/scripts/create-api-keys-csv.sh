#!/bin/bash
#
# Import the generated file into https://eu-central-1.console.aws.amazon.com/apigateway/home?region=eu-central-1#/api-keys/import
#
# CSV file format example:
#
# Name,Key,description,Enabled,usageplanIds
# mdc-stress-test,adialdIfjwjihfkjwWEFKJHsdfkjikkkkKJFHAKSJDFHWA,An imported key,TRUE,tmvi41
# mdc-stress-test,adialdkfxXXWhfkjwWEFKJHsdfkjikkkkKJFHAKSJDFHWA,An imported key,TRUE,tmvi41
#
# To delete the API Keys, simply run the delete-all-api-keys.sh script
#
echo Name,Key,description,Enabled,usageplanIds
for ((i=1;i<=${1:-1000};i++));
do
   echo mdc-stress-test,`date +%s%N|md5sum|cut -d' ' -f1`,An auto-generated MD Collector stress test key,TRUE,tmvi41
done
