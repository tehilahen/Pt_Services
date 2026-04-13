#!/usr/bin/env python3
"""
לקוח NVD API - שאילתות ל-National Vulnerability Database
דף זה אחראי על:
- שאילתות ל-NVD API לקבלת מידע על CVE numbers
- חילוץ ציוני CVSS מדויקים מ-NVD
- חילוץ תיאורים, תאריכים, וקישורים רלוונטיים
- תמיכה ב-CVSS v3.0 ו-v3.1
- עיבוד תגובות JSON מ-NVD API
"""

import json
import requests
import os
import urllib3
import logging

# Disable SSL warnings for testing (can be enabled in production)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

# Configuration
NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'
# API key MUST be set via environment variable NVD_API_KEY
# Get a free API key from: https://nvd.nist.gov/developers/request-an-api-key
API_KEY = os.getenv('NVD_API_KEY')
if not API_KEY:
    logger.warning("NVD_API_KEY לא מוגדר ב-.env - הבקשות ל-NVD יהיו מוגבלות בקצב")
NVD_USER_AGENT = 'Nikto-NVD-Client/1.0'
timeout = 30

def query_nvd_api(cve_id):
    """Query the NVD API for CVE information"""
    
    # Build API request URL
    url = f"{NVD_API_BASE}?cveId={cve_id}"
    
    logger.debug(f"Requesting NVD API: {url}")
    
    # Prepare headers
    headers = {
        'User-Agent': NVD_USER_AGENT,
    }
    
    # Add API key if available
    if API_KEY:
        headers['apiKey'] = API_KEY
    
    try:
        # Make API request
        # Note: verify=False is used here for compatibility, but should be True in production
        response = requests.get(url, headers=headers, timeout=timeout, verify=False)
        
        if response.status_code == 200:
            json_data = response.json()
            return extract_nvd_info(json_data)
        else:
            logger.warning(f"NVD API Request Failed: {response.status_code} {response.reason}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"NVD API Request Error: {e}")
        return None

def extract_nvd_info(json_data):
    """Extract relevant NVD data from JSON response"""
    
    nvd_info = {
        'cve_id': '',
        'description': '',
        'cvss_v3_score': '',
        'cvss_v3_severity': '',
        'cvss_v3_vector': '',
        'published_date': '',
        'last_modified_date': '',
        'references': [],
        'cwe_ids': []
    }
    
    # Extract data from NVD JSON response
    if 'vulnerabilities' in json_data and len(json_data['vulnerabilities']) > 0:
        cve = json_data['vulnerabilities'][0]['cve']
        
        nvd_info['cve_id'] = cve.get('id', '')
        
        # Extract description
        if 'descriptions' in cve and len(cve['descriptions']) > 0:
            for desc in cve['descriptions']:
                if desc.get('lang') == 'en':
                    nvd_info['description'] = desc.get('value', '')
                    break
        
        # Extract CVSS v3 metrics (prefer v3.1, fallback to v3.0)
        if 'metrics' in cve:
            cvss_data = None
            if 'cvssMetricV31' in cve['metrics']:
                cvss = cve['metrics']['cvssMetricV31'][0]
                cvss_data = cvss.get('cvssData', {})
            elif 'cvssMetricV30' in cve['metrics']:
                cvss = cve['metrics']['cvssMetricV30'][0]
                cvss_data = cvss.get('cvssData', {})
            
            if cvss_data:
                nvd_info['cvss_v3_score'] = cvss_data.get('baseScore', '')
                nvd_info['cvss_v3_severity'] = cvss_data.get('baseSeverity', '')
                nvd_info['cvss_v3_vector'] = cvss_data.get('vectorString', '')
        
        # Extract dates
        nvd_info['published_date'] = cve.get('published', '')
        nvd_info['last_modified_date'] = cve.get('lastModified', '')
        
        # Extract references
        if 'references' in cve:
            nvd_info['references'] = [ref.get('url', '') for ref in cve['references']]
        
        # Extract CWE IDs
        if 'weaknesses' in cve:
            for weakness in cve['weaknesses']:
                for desc in weakness.get('description', []):
                    if desc.get('lang') == 'en':
                        nvd_info['cwe_ids'].append(desc.get('value', ''))
    
    return nvd_info

