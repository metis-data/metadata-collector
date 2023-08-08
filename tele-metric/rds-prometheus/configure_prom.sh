script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ask for API key
while [ -z "$METIS_API_KEY" ]; do
    echo "Please provide Metis API key:"
    read -r METIS_API_KEY
done

api_key="$METIS_API_KEY"

escaped_api_key=$(printf '%s\n' "$api_key" | sed -e 's/[\/&]/\\&/g')

# Replace the apiKey value in the Prometheus YAML file
awk -v new_apikey="$escaped_api_key" '/apikey:/ { sub(/:.*/, ": '\''" new_apikey "'\''") } 1' "$script_dir/prometheus.yml" > temp_prometheus.yml
mv temp_prometheus.yml "$script_dir/prometheus.yml"
