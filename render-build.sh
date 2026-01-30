#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# npm run build # if you had a build step

# Print where chromium is installed for debugging
which google-chrome-stable || true
