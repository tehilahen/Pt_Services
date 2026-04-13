#!/usr/bin/env python3
"""
Enhance Nikto CSV Output with CVSS Data
Adds CVSS scores and severity levels to existing Nikto CSV files

Usage:
    python enhance_nikto_csv.py input.csv output.csv
    python enhance_nikto_csv.py scan_results.csv enhanced_results.csv
"""

import sys
import csv
import argparse
from cvss_mapper import CVSSMapper

def enhance_csv_file(input_file, output_file, use_nvd=False):
    """Enhance a Nikto CSV file with CVSS data"""
    
    mapper = CVSSMapper()
    
    with open(input_file, 'r', newline='', encoding='utf-8') as infile:
        # Read the first line to determine if it's a header
        first_line = infile.readline().strip()
        infile.seek(0)
        
        # Check if first line is a header (contains "Nikto")
        if "Nikto" in first_line:
            # Skip the header line
            next(infile)
        
        reader = csv.reader(infile)
        
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            
            # Write enhanced header
            writer.writerow([
                'Hostname', 'IP', 'Port', 'References', 'Method', 'URL', 
                'Message', 'CVSS Score', 'Severity', 'CVE', 'Confidence'
            ])
            
            for row in reader:
                if len(row) >= 7:  # Ensure we have enough columns
                    # Extract the message (usually column 6, 0-indexed)
                    message = row[6] if len(row) > 6 else ""
                    
                    # Get CVSS mapping
                    result = mapper.map_finding(message, use_nvd=use_nvd)
                    
                    # Add CVSS columns
                    enhanced_row = row + [
                        result.cvss,
                        result.severity,
                        result.cve or "",
                        result.confidence
                    ]
                    
                    writer.writerow(enhanced_row)
                else:
                    # If row doesn't have enough columns, write as-is
                    writer.writerow(row)
    
    print(f"Enhanced CSV saved to: {output_file}")

def main():
    parser = argparse.ArgumentParser(description='Enhance Nikto CSV with CVSS data')
    parser.add_argument('input_file', help='Input Nikto CSV file')
    parser.add_argument('output_file', help='Output enhanced CSV file')
    parser.add_argument('--use-nvd', action='store_true', help='Enable NVD API lookups')
    
    args = parser.parse_args()
    
    try:
        enhance_csv_file(args.input_file, args.output_file, args.use_nvd)
        print("CSV enhancement completed successfully!")
    except Exception as e:
        print(f"Error enhancing CSV: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

