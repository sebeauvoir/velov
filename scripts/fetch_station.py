#!/usr/bin/env python3
"""Polls the JCDecaux Open API for the Decines Centre Velo'v station and
appends one JSON-line record to data/history.jsonl.

Requires a free API key from https://developer.jcdecaux.com/, passed via the
JCDECAUX_API_KEY environment variable.
"""
import json
import os
import sys
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone

CONTRACT = "lyon"
STATION_MATCH = ("decines", "centre")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.environ.get("DATA_FILE") or os.path.join(ROOT, "data", "history.jsonl")
API_URL = "https://api.jcdecaux.com/vls/v1/stations?contract={contract}&apiKey={key}"


def normalize(text):
    text = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def find_station(stations):
    for station in stations:
        haystack = normalize(f"{station.get('name', '')} {station.get('address', '')}")
        if all(part in haystack for part in STATION_MATCH):
            return station
    return None


def main():
    api_key = os.environ.get("JCDECAUX_API_KEY")
    if not api_key:
        print("JCDECAUX_API_KEY is not set", file=sys.stderr)
        sys.exit(1)

    url = API_URL.format(contract=CONTRACT, key=api_key)
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            stations = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        print(f"Failed to fetch stations: {exc}", file=sys.stderr)
        sys.exit(1)

    station = find_station(stations)
    if station is None:
        print("Station 'Decines Centre' not found in contract 'lyon'", file=sys.stderr)
        sys.exit(1)

    record = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "name": station.get("name"),
        "bikes": station.get("available_bikes"),
        "stands": station.get("available_bike_stands"),
        "capacity": station.get("bike_stands"),
        "status": station.get("status"),
    }

    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Logged: {record}")


if __name__ == "__main__":
    main()
