#!/bin/bash

# Determine the script's directory and set it as the current working directory
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir" || exit

capitalize_word() {
    local input="$1"
    local first_char="${input:0:1}"
    local rest_of_word="${input:1}"
    local capitalized_word="$(echo "$first_char" | tr '[:lower:]' '[:upper:]')$rest_of_word"
    echo "$capitalized_word"
}

echo_red() {
    local red_color='\033[0;31m'
    local reset_color='\033[0m'
    echo -e "${red_color}$1${reset_color}"
}

# Function to check if Docker is running
check_docker_running() {
    if ! docker info &>/dev/null; then
        echo_red  "[-] Docker is not running."
        exit 1
    fi
}

# Function to check if a command is installed
check_command() {
    if command -v "$1" &>/dev/null; then
        capitalized=$(capitalize_word $1)
        echo "[+] $capitalized is installed."
        check_docker_running
    else
        capitalized=$(capitalize_word $1)
        echo_red "$capitalized is not installed."
        exit 1
    fi
}

# Prerequisites Check
echo "- Prerequisites Check:"

# Check for Docker installation
check_command "docker"

# Check for Docker Compose installation
check_command "docker-compose"

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


# Set a flag to determine if the script has arguments (true) or not (false)
has_arguments=0

# Check if any arguments were provided
if [ "$#" -gt 0 ]; then
    has_arguments=1
fi


if [ "$has_arguments" -eq 1 ]; then
    for arg in "$@"; do
        # Check if the argument is a valid service
        if is_valid_service "$arg"; then
            valid_services+=("$arg")
        else
            echo "Invalid service: $arg"
            exit 1
        fi
    done

    docker-compose -p tele-metric -f "$script_dir/rds-prometheus/docker-compose.yaml" up -d "${valid_services[@]}"

else
    # We would like to set ap METIS API 
    $script_dir/rds-prometheus/configure_prom.sh
    docker-compose -p tele-metric \
    -f "$script_dir/rds-prometheus/docker-compose.yaml" \
    -f "$script_dir/rds-prometheus/docker-compose.stack.yaml" \
    up -d yace grafana prometheus
fi

