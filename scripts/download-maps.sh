#!/bin/bash
# Download higher-resolution map data from Natural Earth
# Run this script to get better looking maps

set -e

DATA_DIR="$(dirname "$0")/../src/data"
TEMP_DIR="$(mktemp -d)"

echo "Downloading Natural Earth 50m data..."

# US States (50m)
echo "  - US States..."
curl -sL "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson" -o "$TEMP_DIR/states.geojson"

# World Countries (50m)
echo "  - World Countries..."
curl -sL "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson" -o "$TEMP_DIR/countries.geojson"

echo ""
echo "Downloaded files to: $TEMP_DIR"
echo ""
echo "To use these files, you'll need to:"
echo "1. Filter and format them to match the expected property names"
echo "2. Add DIFFICULTY property to each feature"
echo "3. Replace the files in $DATA_DIR"
echo ""
echo "Example using jq to filter US states:"
echo "  jq '.features |= map(select(.properties.iso_3166_2 | startswith(\"US-\")))' $TEMP_DIR/states.geojson"
echo ""
echo "Note: The current map files work, they just have lower resolution."
echo "Higher resolution files will make the maps look better but increase bundle size."

# Cleanup option
echo ""
read -p "Delete temp files? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEMP_DIR"
    echo "Cleaned up."
fi
