#!/bin/bash

# Determine the script's directory and set it as the current working directory
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir" || exit

./start_stack.sh yace
