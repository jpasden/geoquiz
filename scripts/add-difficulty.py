#!/usr/bin/env python3
"""
Add DIFFICULTY property to GeoJSON features based on criteria:
- 1 (Easy): Large/famous (California, France, China)
- 2: Recognizable (Oregon, Spain, Shandong)
- 3 (Medium): Moderate (Iowa, Bulgaria, Henan)
- 4: Obscure (Wyoming, Moldova, Qinghai)
- 5 (Hard): Tiny/unusual shapes (Rhode Island, Liechtenstein)
"""

import json
import os

# Difficulty assignments by state/country code or name
US_DIFFICULTY = {
    # Level 1 - Famous/Large
    'CA': 1, 'TX': 1, 'FL': 1, 'NY': 1, 'AK': 1, 'HI': 1,
    # Level 2 - Recognizable
    'WA': 2, 'OR': 2, 'AZ': 2, 'CO': 2, 'IL': 2, 'PA': 2, 'OH': 2, 'MI': 2, 'GA': 2, 'NC': 2,
    'NV': 2, 'UT': 2, 'NM': 2, 'MA': 2, 'NJ': 2,
    # Level 3 - Moderate
    'VA': 3, 'WI': 3, 'MN': 3, 'TN': 3, 'MO': 3, 'IN': 3, 'KY': 3, 'LA': 3, 'SC': 3, 'AL': 3,
    'OK': 3, 'KS': 3, 'IA': 3, 'AR': 3, 'MS': 3,
    # Level 4 - Obscure
    'ID': 4, 'MT': 4, 'WY': 4, 'ND': 4, 'SD': 4, 'NE': 4, 'WV': 4, 'ME': 4, 'NH': 4, 'VT': 4,
    'MD': 4, 'CT': 4,
    # Level 5 - Tiny/Unusual
    'RI': 5, 'DE': 5, 'DC': 5,
}

WORLD_DIFFICULTY = {
    # Level 1 - Famous/Large
    'US': 1, 'CN': 1, 'RU': 1, 'BR': 1, 'AU': 1, 'IN': 1, 'CA': 1,
    'FR': 1, 'DE': 1, 'GB': 1, 'JP': 1, 'IT': 1, 'MX': 1, 'ES': 1,
    # Level 2 - Recognizable
    'AR': 2, 'EG': 2, 'ZA': 2, 'NG': 2, 'KE': 2, 'SA': 2, 'TR': 2, 'IR': 2,
    'PK': 2, 'ID': 2, 'TH': 2, 'VN': 2, 'KR': 2, 'PH': 2, 'MY': 2,
    'PL': 2, 'NL': 2, 'BE': 2, 'SE': 2, 'NO': 2, 'CH': 2, 'AT': 2, 'GR': 2,
    'PT': 2, 'IE': 2, 'DK': 2, 'FI': 2,
    # Level 3 - Moderate
    'CL': 3, 'CO': 3, 'PE': 3, 'VE': 3, 'EC': 3,
    'MA': 3, 'DZ': 3, 'LY': 3, 'SD': 3, 'ET': 3, 'TZ': 3,
    'UA': 3, 'RO': 3, 'CZ': 3, 'HU': 3, 'BG': 3, 'RS': 3, 'HR': 3,
    'NZ': 3, 'AF': 3, 'IQ': 3, 'SY': 3, 'IL': 3, 'JO': 3, 'LB': 3,
    'BD': 3, 'MM': 3, 'NP': 3, 'LK': 3, 'KH': 3,
    # Level 4 - Obscure
    'BO': 4, 'PY': 4, 'UY': 4, 'GY': 4, 'SR': 4,
    'TN': 4, 'SN': 4, 'GH': 4, 'CI': 4, 'CM': 4, 'UG': 4, 'AO': 4, 'MZ': 4,
    'ZM': 4, 'ZW': 4, 'BW': 4, 'NA': 4, 'MG': 4,
    'SK': 4, 'SI': 4, 'BA': 4, 'MK': 4, 'AL': 4, 'ME': 4, 'XK': 4,
    'LT': 4, 'LV': 4, 'EE': 4, 'BY': 4, 'MD': 4,
    'KZ': 4, 'UZ': 4, 'TM': 4, 'KG': 4, 'TJ': 4, 'AZ': 4, 'GE': 4, 'AM': 4,
    'MN': 4, 'KP': 4, 'LA': 4, 'BT': 4,
    # Level 5 - Tiny/Unusual
    'BN': 5, 'TL': 5, 'SG': 5,
    'CY': 5, 'MT': 5, 'LU': 5, 'LI': 5, 'AD': 5, 'MC': 5, 'SM': 5, 'VA': 5,
    'IS': 5,
    'BZ': 5, 'GT': 5, 'HN': 5, 'SV': 5, 'NI': 5, 'CR': 5, 'PA': 5,
    'JM': 5, 'CU': 5, 'HT': 5, 'DO': 5, 'PR': 5, 'TT': 5,
}

CHINA_DIFFICULTY = {
    # Level 1 - Famous/Large
    'BJ': 1, 'SH': 1, 'GD': 1, 'JS': 1, 'ZJ': 1, 'SC': 1,
    # Level 2 - Recognizable
    'SD': 2, 'HN': 2, 'HB': 2, 'FJ': 2, 'TJ': 2, 'CQ': 2, 'XZ': 2, 'XJ': 2,
    # Level 3 - Moderate
    'AH': 3, 'JX': 3, 'SX': 3, 'HA': 3, 'LN': 3, 'JL': 3, 'HL': 3, 'YN': 3, 'GZ': 3,
    # Level 4 - Obscure
    'GX': 4, 'HI': 4, 'SN': 4, 'GS': 4, 'NX': 4, 'QH': 4, 'NM': 4,
    # Level 5 - Tiny
    'HK': 5, 'MO': 5, 'TW': 5,
}

EUROPE_DIFFICULTY = {
    # Level 1 - Famous/Large
    'FR': 1, 'DE': 1, 'GB': 1, 'IT': 1, 'ES': 1, 'RU': 1, 'UA': 1,
    # Level 2 - Recognizable
    'PL': 2, 'NL': 2, 'BE': 2, 'SE': 2, 'NO': 2, 'CH': 2, 'AT': 2, 'GR': 2,
    'PT': 2, 'IE': 2, 'DK': 2, 'FI': 2,
    # Level 3 - Moderate
    'RO': 3, 'CZ': 3, 'HU': 3, 'BG': 3, 'RS': 3, 'HR': 3, 'TR': 3,
    # Level 4 - Obscure
    'SK': 4, 'SI': 4, 'BA': 4, 'MK': 4, 'AL': 4, 'ME': 4, 'XK': 4,
    'LT': 4, 'LV': 4, 'EE': 4, 'BY': 4, 'MD': 4,
    # Level 5 - Tiny
    'CY': 5, 'MT': 5, 'LU': 5, 'LI': 5, 'AD': 5, 'MC': 5, 'SM': 5, 'VA': 5, 'IS': 5,
}

def get_difficulty(props, difficulty_map, code_key='STUSPS', default=3):
    """Get difficulty for a feature based on its code."""
    code = props.get(code_key)
    if code:
        code = code.upper().replace('US-', '').replace('CN-', '')
        return difficulty_map.get(code, default)

    # Try ISO codes for world
    for key in ['ISO_A2', 'iso_a2', 'ADM0_A3', 'adm0_a3']:
        code = props.get(key, '').upper()
        if code and code in difficulty_map:
            return difficulty_map[code]

    return default

def add_difficulty_to_file(filepath, difficulty_map, code_key='STUSPS'):
    """Add DIFFICULTY to all features in a GeoJSON file."""
    with open(filepath, 'r') as f:
        data = json.load(f)

    for feature in data.get('features', []):
        props = feature.get('properties', {})
        diff = get_difficulty(props, difficulty_map, code_key)
        props['DIFFICULTY'] = diff

    with open(filepath, 'w') as f:
        json.dump(data, f, separators=(',', ':'))

    print(f"Updated {filepath}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'src', 'data')

    # US States
    add_difficulty_to_file(
        os.path.join(data_dir, 'us-states.json'),
        US_DIFFICULTY,
        'STUSPS'
    )

    # US Points (cities/capitals use state difficulty)
    us_points = os.path.join(data_dir, 'us-points.json')
    with open(us_points, 'r') as f:
        data = json.load(f)
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        state = props.get('STATE', props.get('state', ''))
        props['DIFFICULTY'] = US_DIFFICULTY.get(state, 3)
    with open(us_points, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Updated {us_points}")

    # World Countries
    add_difficulty_to_file(
        os.path.join(data_dir, 'world-countries.json'),
        WORLD_DIFFICULTY,
        'ISO_A2'
    )

    # World Capitals
    world_caps = os.path.join(data_dir, 'world-capitals.json')
    with open(world_caps, 'r') as f:
        data = json.load(f)
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        country = props.get('COUNTRY_CODE', props.get('country_code', ''))
        props['DIFFICULTY'] = WORLD_DIFFICULTY.get(country.upper(), 3)
    with open(world_caps, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Updated {world_caps}")

    # China Provinces
    add_difficulty_to_file(
        os.path.join(data_dir, 'china-provinces.json'),
        CHINA_DIFFICULTY,
        'ADM1_CODE'
    )

    # China Points
    china_points = os.path.join(data_dir, 'china-points.json')
    with open(china_points, 'r') as f:
        data = json.load(f)
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        prov = props.get('PROVINCE_CODE', props.get('province_code', ''))
        props['DIFFICULTY'] = CHINA_DIFFICULTY.get(prov, 3)
    with open(china_points, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Updated {china_points}")

    # Europe Countries
    add_difficulty_to_file(
        os.path.join(data_dir, 'europe-countries.json'),
        EUROPE_DIFFICULTY,
        'ISO_A2'
    )

    # Europe Points
    europe_points = os.path.join(data_dir, 'europe-points.json')
    with open(europe_points, 'r') as f:
        data = json.load(f)
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        country = props.get('COUNTRY_CODE', props.get('country_code', ''))
        props['DIFFICULTY'] = EUROPE_DIFFICULTY.get(country.upper(), 3)
    with open(europe_points, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Updated {europe_points}")

    print("\nDone! All files updated with DIFFICULTY property.")

if __name__ == '__main__':
    main()
