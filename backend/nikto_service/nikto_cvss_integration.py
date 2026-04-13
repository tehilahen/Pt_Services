#!/usr/bin/env python3
"""
Nikto CVSS Integration Module
Provides a bridge between Nikto (Perl) and the Python CVSS mapping system

This module can be called from Perl scripts to get CVSS mappings for findings.
It provides both command-line interface and JSON-based communication.

Usage:
    # Command line
    python nikto_cvss_integration.py "X-Frame-Options missing"
    
    # JSON input/output
    echo '{"finding": "X-Frame-Options missing"}' | python nikto_cvss_integration.py --json
    
    # Batch processing
    python nikto_cvss_integration.py --batch findings.txt
"""

import sys
import json
import argparse
from typing import List, Dict, Optional
from cvss_mapper import CVSSMapper, CVSSResult
from enhanced_nvd_client import EnhancedNVDClient

class NiktoCVSSIntegration:
    """Integration layer between Nikto and CVSS mapping system"""
    
    def __init__(self, use_nvd: bool = False, cache_enabled: bool = True):
        """
        Initialize Nikto CVSS integration
        
        Args:
            use_nvd: Whether to use NVD API for CVE lookups
            cache_enabled: Whether to enable NVD caching
        """
        self.cvss_mapper = CVSSMapper()
        self.use_nvd = use_nvd
        
        if use_nvd and cache_enabled:
            self.nvd_client = EnhancedNVDClient()
        else:
            self.nvd_client = None
    
    def process_single_finding(self, finding: str) -> Dict:
        """Process a single Nikto finding and return CVSS information"""
        result = self.cvss_mapper.map_finding(finding, use_nvd=self.use_nvd)
        
        return {
            "finding": result.finding,
            "cvss": result.cvss,
            "severity": result.severity,
            "cve": result.cve,
            "description": result.description,
            "confidence": result.confidence
        }
    
    def process_batch_findings(self, findings: List[str]) -> List[Dict]:
        """Process multiple Nikto findings"""
        results = []
        for finding in findings:
            result = self.process_single_finding(finding)
            results.append(result)
        return results
    
    def process_nikto_json(self, nikto_json_data: Dict) -> Dict:
        """
        Process Nikto JSON output and add CVSS information
        
        Args:
            nikto_json_data: Nikto scan results in JSON format
            
        Returns:
            Enhanced JSON with CVSS information added
        """
        enhanced_data = nikto_json_data.copy()
        
        # Process each host's vulnerabilities
        if isinstance(enhanced_data, list):
            for host_data in enhanced_data:
                if 'vulnerabilities' in host_data:
                    for vuln in host_data['vulnerabilities']:
                        if 'msg' in vuln:
                            # Extract message and get CVSS mapping
                            finding_text = vuln['msg']
                            if isinstance(finding_text, str):
                                # Remove JSON encoding artifacts
                                finding_text = finding_text.strip('"')
                                
                                cvss_result = self.process_single_finding(finding_text)
                                
                                # Add CVSS information to vulnerability
                                vuln['cvss_score'] = cvss_result['cvss']
                                vuln['severity'] = cvss_result['severity']
                                if cvss_result['cve']:
                                    vuln['cve'] = cvss_result['cve']
                                vuln['cvss_confidence'] = cvss_result['confidence']
        
        return enhanced_data
    
    def generate_severity_summary(self, findings: List[str]) -> Dict:
        """Generate a summary of findings by severity level"""
        results = self.process_batch_findings(findings)
        
        summary = {
            "CRITICAL": [],
            "HIGH": [],
            "MEDIUM": [],
            "LOW": [],
            "INFORMATIONAL": []
        }
        
        for result in results:
            severity = result['severity']
            if severity in summary:
                summary[severity].append(result)
        
        # Add counts
        summary_with_counts = {}
        for severity, items in summary.items():
            summary_with_counts[severity] = {
                "count": len(items),
                "findings": items
            }
        
        return summary_with_counts
    
    def export_enhanced_report(self, nikto_results: Dict, output_file: str, format_type: str = "json"):
        """Export enhanced Nikto report with CVSS information"""
        enhanced_results = self.process_nikto_json(nikto_results)
        
        if format_type.lower() == "json":
            with open(output_file, 'w') as f:
                json.dump(enhanced_results, f, indent=2)
        elif format_type.lower() == "csv":
            self._export_csv(enhanced_results, output_file)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def _export_csv(self, enhanced_results: Dict, output_file: str):
        """Export results to CSV format"""
        import csv
        
        with open(output_file, 'w', newline='') as csvfile:
            fieldnames = ['host', 'ip', 'port', 'url', 'method', 'finding', 'cvss_score', 'severity', 'cve', 'confidence']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            if isinstance(enhanced_results, list):
                for host_data in enhanced_results:
                    host_info = {
                        'host': host_data.get('host', ''),
                        'ip': host_data.get('ip', ''),
                        'port': host_data.get('port', '')
                    }
                    
                    if 'vulnerabilities' in host_data:
                        for vuln in host_data['vulnerabilities']:
                            row = host_info.copy()
                            row.update({
                                'url': vuln.get('url', ''),
                                'method': vuln.get('method', ''),
                                'finding': vuln.get('msg', '').strip('"'),
                                'cvss_score': vuln.get('cvss_score', ''),
                                'severity': vuln.get('severity', ''),
                                'cve': vuln.get('cve', ''),
                                'confidence': vuln.get('cvss_confidence', '')
                            })
                            writer.writerow(row)

def main():
    """Command-line interface for Nikto CVSS integration"""
    parser = argparse.ArgumentParser(description='Nikto CVSS Integration Tool')
    parser.add_argument('finding', nargs='?', help='Single finding to process')
    parser.add_argument('--json', action='store_true', help='Process JSON input from stdin')
    parser.add_argument('--batch', help='Process batch of findings from file')
    parser.add_argument('--use-nvd', action='store_true', help='Enable NVD API lookups')
    parser.add_argument('--summary', action='store_true', help='Generate severity summary')
    parser.add_argument('--output', help='Output file (for batch processing)')
    parser.add_argument('--format', choices=['json', 'csv'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    # Initialize integration
    integration = NiktoCVSSIntegration(use_nvd=args.use_nvd)
    
    if args.json:
        # Process JSON input from stdin
        try:
            input_data = json.load(sys.stdin)
            if 'finding' in input_data:
                result = integration.process_single_finding(input_data['finding'])
                print(json.dumps(result, indent=2))
            else:
                # Assume it's Nikto JSON output
                enhanced = integration.process_nikto_json(input_data)
                print(json.dumps(enhanced, indent=2))
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON input: {e}", file=sys.stderr)
            sys.exit(1)
    
    elif args.batch:
        # Process batch of findings from file
        try:
            with open(args.batch, 'r') as f:
                findings = [line.strip() for line in f if line.strip()]
            
            results = integration.process_batch_findings(findings)
            
            if args.summary:
                summary = integration.generate_severity_summary(findings)
                output_data = {"summary": summary, "detailed_results": results}
            else:
                output_data = results
            
            if args.output:
                with open(args.output, 'w') as f:
                    if args.format == 'json':
                        json.dump(output_data, f, indent=2)
                    else:
                        integration.export_enhanced_report(output_data, args.output, args.format)
            else:
                print(json.dumps(output_data, indent=2))
                
        except FileNotFoundError:
            print(f"Error: File {args.batch} not found", file=sys.stderr)
            sys.exit(1)
    
    elif args.finding:
        # Process single finding
        result = integration.process_single_finding(args.finding)
        print(json.dumps(result, indent=2))
    
    else:
        # Interactive mode - show help
        parser.print_help()
        print("\nExamples:")
        print("  python nikto_cvss_integration.py 'X-Frame-Options missing'")
        print("  echo '{\"finding\": \"SQL injection\"}' | python nikto_cvss_integration.py --json")
        print("  python nikto_cvss_integration.py --batch findings.txt --summary")

if __name__ == "__main__":
    main()

