#!/bin/bash

# Determine the script's directory and set it as the current working directory
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir" || exit

# Function to check if a service is valid
function is_valid_service() {
    local service=$1
    case "$service" in
    yace | prometheus | grafana)
        return 0
        ;;
    *)
        return 1
        ;;
    esac
}

# Array to store valid service names
valid_services=()

# Loop through each argument
for arg in "$@"; do
    # Check if the argument is a valid service
    if is_valid_service "$arg"; then
        valid_services+=("$arg")
    else
        echo "Invalid service: $arg"
        exit 1
    fi
done

# Check if at least one valid service argument is provided
if [ ${#valid_services[@]} -eq 0 ]; then
    echo "No services provided. Running with default service 'yace exporter'"
    valid_services=("yace")
else
    echo "Selected services: ${valid_services[*]}"
fi

# Now you can use the $service_name variable in your script for further processing

# Ask for API key
while [ -z "$METIS_API_KEY" ]; do
    echo "Please provide Metis API key:"
    read -r METIS_API_KEY
done

api_key="$METIS_API_KEY"

service_name="$1"

# escaped_api_key=$(printf '%s\n' "$api_key" | sed -e 's/[]\/$*.^[]/\\&/g')

escaped_api_key=$(printf '%s\n' "$api_key" | sed -e 's/[\/&]/\\&/g')

# Replace the apiKey value in the Prometheus YAML file
awk -v new_apikey="$escaped_api_key" '/apikey:/ { sub(/:.*/, ": '\''" new_apikey "'\''") } 1' "$script_dir/rds-prometheus/prometheus.yml" >temp_prometheus.yml
mv temp_prometheus.yml "$script_dir/rds-prometheus/prometheus.yml"

docker-compose -p tele-metric -f "$script_dir/rds-prometheus/docker-compose.yaml" up -d "${valid_services[@]}"
