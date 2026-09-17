#!/usr/bin/env python3
"""Polls the JCDecaux Open API for every Velo'v station in the Lyon
network and records a snapshot for each one.

Writes:
- data/stations.json: metadata for every station (name, position,
  capacity, ...), overwritten in full on each run.
- data/stations/<number>.jsonl: one JSON-line snapshot appended per
  station per run.

Requires a free API key from https://developer.jcdecaux.com/, passed via the
JCDECAUX_API_KEY environment variable.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

CONTRACT = "lyon"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get("DATA_DIR") or os.path.join(ROOT, "data")
STATIONS_FILE = os.path.join(DATA_DIR, "stations.json")
STATIONS_DIR = os.path.join(DATA_DIR, "stations")
API_URL = "https://api.jcdecaux.com/vls/v3/stations?contract={contract}&apiKey={key}"


def fetch_stations(api_key):
    url = API_URL.format(contract=CONTRACT, key=api_key)
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    api_key = os.environ.get("JCDECAUX_API_KEY")
    if not api_key:
        print("JCDECAUX_API_KEY is not set", file=sys.stderr)
        sys.exit(1)

    try:
        stations = fetch_stations(api_key)
    except urllib.error.URLError as exc:
        print(f"Failed to fetch stations: {exc}", file=sys.stderr)
        sys.exit(1)

    if not stations:
        print("No stations returned by the API", file=sys.stderr)
        sys.exit(1)

    os.makedirs(STATIONS_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")

    metadata = []
    for station in stations:
        number = station.get("number")
        if number is None:
            continue
        position = station.get("position") or {}
        total_stands = station.get("totalStands") or {}
        availabilities = total_stands.get("availabilities") or {}

        metadata.append(
            {
                "number": number,
                "name": station.get("name"),
                "address": station.get("address"),
                "lat": position.get("latitude"),
                "lng": position.get("longitude"),
                "capacity": total_stands.get("capacity"),
            }
        )

        record = {
            "ts": ts,
            "bikes": availabilities.get("bikes"),
            "bikes_mechanical": availabilities.get("mechanicalBikes"),
            "bikes_electric": availabilities.get("electricalBikes"),
            "stands": availabilities.get("stands"),
            "capacity": total_stands.get("capacity"),
            "status": station.get("status"),
        }
        station_file = os.path.join(STATIONS_DIR, f"{number}.jsonl")
        with open(station_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    with open(STATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    print(f"Logged {len(metadata)} stations at {ts}")


if __name__ == "__main__":
    main()
