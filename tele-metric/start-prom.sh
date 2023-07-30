# Determine the script's directory and set it as the current working directory
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir" || exit

echo $script_dir

# Check if an argument is provided
if [ -z "$1" ]; then
    service_name="yace"
fi

# Ask for API key
while [ -z "$METIS_API_KEY" ]; do
    echo "Please provide the API key:"
    read -r METIS_API_KEY
done

api_key="$METIS_API_KEY"

service_name="$1"

# escaped_api_key=$(printf '%s\n' "$api_key" | sed -e 's/[]\/$*.^[]/\\&/g')

escaped_api_key=$(printf '%s\n' "$api_key" | sed -e 's/[\/&]/\\&/g')
echo $escaped_api_key

# Replace the apiKey value in the Prometheus YAML file
awk -v new_apikey="$escaped_api_key" '/apikey:/ { sub(/:.*/, ": '\''" new_apikey "'\''") } 1' "$script_dir/rds-prometheus/prometheus.yml" >temp_prometheus.yml
mv temp_prometheus.yml "$script_dir/rds-prometheus/prometheus.yml"

docker-compose -p tele-metric -f "$script_dir/rds-prometheus/docker-compose.yaml" up -d $service_name
