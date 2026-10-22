#!/usr/bin/env python3
"""
Ingests clinical neurosurgery DICOM datasets from DATA PNR CHU BLIDA into Orthanc PACS.
Target: Neurosurgery Department, CHU Frantz Fanon, Blida.
"""

import os
import sys
import time
import argparse
import subprocess
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

def get_orthanc_host():
    try:
        ip = subprocess.check_output(
            ["docker", "inspect", "openmrs-emr-orthanc-1", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
            text=True
        ).strip()
        if ip:
            return f"http://{ip}:8042"
    except Exception:
        pass
    return "http://localhost:8042"

def post_dicom_slice(url, file_path):
    with open(file_path, "rb") as f:
        data = f.read()

    req = urllib.request.Request(
        f"{url}/instances",
        data=data,
        headers={"Content-Type": "application/dicom"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status

def collect_files(data_dir, group_filter=None):
    files = []
    groups = ["DICOMC", "DICOMA"]
    if group_filter:
        groups = [g for g in groups if g.lower() == group_filter.lower()]

    for g in groups:
        path = os.path.join(data_dir, g)
        if not os.path.exists(path):
            continue
        for root, _, filenames in os.walk(path):
            for fn in filenames:
                if not fn.startswith("."):
                    files.append(os.path.join(root, fn))
    return sorted(files)

def get_container_mem(container_name):
    try:
        out = subprocess.check_output(
            ["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}", container_name],
            text=True
        ).strip()
        return out
    except Exception:
        return "N/A"

def main():
    parser = argparse.ArgumentParser(description="Ingest clinical DICOM into Orthanc")
    parser.add_argument("--data-dir", default="../DATA PNR CHU BLIDA", help="Path to DATA PNR CHU BLIDA")
    parser.add_argument("--group", choices=["DICOMA", "DICOMC"], help="Filter by folder group")
    parser.add_argument("--workers", type=int, default=8, help="Parallel upload workers")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of slices (0 = all)")
    args = parser.parse_args()

    orthanc_url = get_orthanc_host()
    print(f"Connecting to Orthanc at {orthanc_url}...")

    # Check connection
    try:
        with urllib.request.urlopen(f"{orthanc_url}/system", timeout=5) as resp:
            print("Orthanc is online and ready.")
    except Exception as e:
        print(f"Failed to reach Orthanc: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Initial Orthanc memory: {get_container_mem('openmrs-emr-orthanc-1')}")
    print(f"Initial Orthanc DB memory: {get_container_mem('openmrs-emr-orthanc-db-1')}")

    files = collect_files(args.data_dir, args.group)
    if args.limit > 0:
        files = files[:args.limit]

    total_files = len(files)
    total_bytes = sum(os.path.getsize(f) for f in files)
    print(f"Found {total_files} DICOM slices to ingest ({total_bytes / (1024*1024):.2f} MB)")

    if total_files == 0:
        print("No files found to ingest.")
        return

    start_time = time.time()
    success_count = 0
    error_count = 0

    print(f"Starting ingestion with {args.workers} workers...")
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(post_dicom_slice, orthanc_url, f): f for f in files}
        for i, future in enumerate(as_completed(futures), start=1):
            fpath = futures[future]
            try:
                status = future.result()
                if status == 200:
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1
                if error_count <= 5:
                    print(f"\nError uploading {fpath}: {e}", file=sys.stderr)

            if i % 250 == 0 or i == total_files:
                elapsed = time.time() - start_time
                rate = i / elapsed if elapsed > 0 else 0
                pct = (i / total_files) * 100
                print(f"Progress: {i}/{total_files} ({pct:.1f}%) | Success: {success_count} | Errors: {error_count} | Rate: {rate:.1f} slices/s | Mem: {get_container_mem('openmrs-emr-orthanc-1')}")

    total_time = time.time() - start_time
    print("\n--- Ingestion Complete ---")
    print(f"Total slices: {total_files}")
    print(f"Successful: {success_count}")
    print(f"Errors: {error_count}")
    print(f"Elapsed time: {total_time:.2f} s ({success_count / total_time:.1f} slices/s)")
    print(f"Final Orthanc memory: {get_container_mem('openmrs-emr-orthanc-1')}")
    print(f"Final Orthanc DB memory: {get_container_mem('openmrs-emr-orthanc-db-1')}")

if __name__ == "__main__":
    main()
