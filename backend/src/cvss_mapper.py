#!/usr/bin/env python3
"""
מיפוי CVSS - ממיר ממצאי חולשות מ-Nikto לציוני CVSS ורמות חומרה
דף זה אחראי על:
- מיפוי ממצאי חולשות לציוני CVSS (0.0-10.0)
- קביעת רמת חומרה (Critical/High/Medium/Low/Informational)
- חיפוש CVE numbers רלוונטיים
- תמיכה ב-NVD API לחיפוש מדויק יותר
- מיפוי על בסיס מילות מפתח וכללי business logic
"""

import re
import json
import os
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass

@dataclass
class CVSSResult:
    """Result of CVSS mapping"""
    finding: str
    cvss: float
    severity: str
    cve: Optional[str] = None
    description: str = ""
    confidence: str = "medium"  # high, medium, low

class CVSSMapper:
    """Maps Nikto findings to CVSS scores using keyword matching and NVD lookup"""
    
    def __init__(self, config_file: Optional[str] = None):
        """Initialize CVSS mapper with configuration"""
        # Use config file in src directory if not specified
        if config_file is None:
            config_file = os.path.join(os.path.dirname(__file__), 'cvss_mappings.json')
        self.config_file = config_file
        self.load_mappings()
    
    def load_mappings(self):
        """Load CVSS mappings from configuration"""
        # Keyword to CVE mappings (high confidence)
        self.nikto_to_cve = {
            "php version disclosure": "CVE-2019-11043",
            "remote file inclusion": "CVE-2007-0237",
            "sql injection": "CVE-2008-5416",
            "command injection": "CVE-2014-6271",
            "directory traversal": "CVE-2019-5418",
            "cross-site scripting": "CVE-2020-35476",
            "server-side request forgery": "CVE-2021-26855",
            "xml external entity": "CVE-2017-5638",
            "remote code execution": "CVE-2021-44228",
            "buffer overflow": "CVE-2021-3156",
        }
        
        # Keyword to CVSS base score mappings (fallback, medium confidence)
        self.nikto_keyword_cvss = {
            # Critical (9.0-10.0)
            "remote code execution": 9.8,
            "command injection": 9.8,
            "sql injection": 9.0,
            "remote file inclusion": 9.0,
            "buffer overflow": 9.0,
            "deserialization": 9.0,
            "xml external entity": 9.1,
            "server-side request forgery": 9.0,
            
            # High (7.0-8.9)
            "directory traversal": 7.5,
            "path traversal": 7.5,
            "local file inclusion": 7.5,
            "authentication bypass": 8.1,
            "privilege escalation": 8.8,
            "session fixation": 7.5,
            "insecure direct object reference": 7.5,
            
            # Medium (4.0-6.9)
            "cross-site scripting": 6.1,
            "xss": 6.1,
            "cross-site request forgery": 6.5,
            "csrf": 6.5,
            "information disclosure": 5.3,
            "php version disclosure": 5.0,
            "server version disclosure": 5.0,
            "version disclosure": 5.0,
            "sensitive information": 5.3,
            "weak authentication": 5.3,
            "default credentials": 6.5,
            "weak password": 5.3,
            "insecure cookie": 4.3,
            "session management": 4.3,
            
            # Low (0.1-3.9)
            "x-frame-options missing": 3.3,
            "clickjacking": 3.3,
            "x-content-type-options missing": 3.1,
            "x-xss-protection missing": 3.1,
            "strict-transport-security missing": 3.7,
            "content-security-policy missing": 3.1,
            "server header": 3.0,
            "banner disclosure": 3.0,
            "http methods": 3.0,
            "options method": 3.0,
            "trace method": 3.0,
            "directory listing": 3.7,
            "backup file": 3.7,
            "test file": 3.7,
            "configuration file": 3.7,
            "robots.txt": 2.6,
            "sitemap.xml": 2.6,
            
            # Informational (0.0)
            "informational": 0.0,
            "info": 0.0,
        }
        
        # Load custom mappings if config file exists
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    custom_config = json.load(f)
                    self.nikto_to_cve.update(custom_config.get('cve_mappings', {}))
                    self.nikto_keyword_cvss.update(custom_config.get('cvss_mappings', {}))
            except Exception as e:
                print(f"Warning: Could not load custom config {self.config_file}: {e}")
    
    def normalize_text(self, text: str) -> str:
        """Normalize finding text for keyword matching"""
        # Convert to lowercase
        text = text.lower()
        
        # Remove common prefixes/suffixes
        text = re.sub(r'^[/\w\-\.]+:\s*', '', text)  # Remove URI prefix
        text = re.sub(r'\s*see:.*$', '', text)  # Remove "See:" references
        text = re.sub(r'\s*\(.*\)$', '', text)  # Remove parenthetical info
        
        # Normalize common terms
        replacements = {
            'header not found': 'missing',
            'header missing': 'missing',
            'not present': 'missing',
            'not set': 'missing',
            'vulnerable to': '',
            'possible': '',
            'potential': '',
            'may be': '',
            'appears to be': '',
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Clean up whitespace and punctuation
        text = re.sub(r'[^\w\s\-]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text
    
    def find_best_keyword_match(self, normalized_text: str) -> Tuple[Optional[str], float]:
        """Find the best matching keyword and return it with confidence score"""
        best_match = None
        best_score = 0
        
        # Check for exact matches first (highest confidence)
        if normalized_text in self.nikto_keyword_cvss:
            return normalized_text, self.nikto_keyword_cvss[normalized_text]
        
        # Check for partial matches
        for keyword, cvss_score in self.nikto_keyword_cvss.items():
            # Calculate match score based on keyword presence
            keyword_words = keyword.split()
            text_words = normalized_text.split()
            
            matches = sum(1 for word in keyword_words if word in text_words)
            if matches > 0:
                # Score based on percentage of keyword words matched
                match_score = matches / len(keyword_words)
                if match_score > best_score:
                    best_score = match_score
                    best_match = keyword
        
        if best_match and best_score >= 0.5:  # Require at least 50% match
            return best_match, self.nikto_keyword_cvss[best_match]
        
        return None, 0.0
    
    def get_severity_from_cvss(self, cvss_score: float) -> str:
        """Convert CVSS score to severity rating"""
        if cvss_score >= 9.0:
            return "CRITICAL"
        elif cvss_score >= 7.0:
            return "HIGH"
        elif cvss_score >= 4.0:
            return "MEDIUM"
        elif cvss_score > 0.0:
            return "LOW"
        else:
            return "INFORMATIONAL"
    
    def map_to_cve(self, normalized_text: str) -> Optional[str]:
        """Check if finding maps to a known CVE"""
        for keyword, cve_id in self.nikto_to_cve.items():
            if keyword in normalized_text:
                return cve_id
        return None
    
    def map_finding(self, finding_text: str, use_nvd: bool = False) -> CVSSResult:
        """
        Map a Nikto finding to CVSS score and severity
        
        Args:
            finding_text: The Nikto vulnerability finding text
            use_nvd: Whether to query NVD API for CVE information
        
        Returns:
            CVSSResult with finding details, CVSS score, and severity
        """
        normalized = self.normalize_text(finding_text)
        
        # Step 1: Check for CVE mapping
        cve_id = self.map_to_cve(normalized)
        
        # Step 2: If CVE found and NVD enabled, query for accurate CVSS
        if cve_id and use_nvd:
            try:
                # Import here to avoid circular imports
                from src.nvd_api_client import query_nvd_api
                nvd_data = query_nvd_api(cve_id)
                if nvd_data and nvd_data.get('cvss_v3_score'):
                    cvss_score = float(nvd_data['cvss_v3_score'])
                    severity = nvd_data.get('cvss_v3_severity', self.get_severity_from_cvss(cvss_score))
                    return CVSSResult(
                        finding=finding_text,
                        cvss=cvss_score,
                        severity=severity,
                        cve=cve_id,
                        description=nvd_data.get('description', ''),
                        confidence="high"
                    )
            except Exception as e:
                print(f"Warning: NVD query failed for {cve_id}: {e}")
        
        # Step 3: Fallback to keyword-based mapping
        keyword, cvss_score = self.find_best_keyword_match(normalized)
        
        if keyword:
            severity = self.get_severity_from_cvss(cvss_score)
            confidence = "high" if cve_id else "medium"
            
            return CVSSResult(
                finding=finding_text,
                cvss=cvss_score,
                severity=severity,
                cve=cve_id,
                description=f"Mapped via keyword: {keyword}",
                confidence=confidence
            )
        
        # Step 4: Default mapping for unknown findings
        return CVSSResult(
            finding=finding_text,
            cvss=3.0,  # Default to low severity
            severity="LOW",
            cve=None,
            description="No specific mapping found, using default score",
            confidence="low"
        )
    
    def batch_map_findings(self, findings: List[str], use_nvd: bool = False) -> List[CVSSResult]:
        """Map multiple findings to CVSS scores"""
        results = []
        for finding in findings:
            result = self.map_finding(finding, use_nvd)
            results.append(result)
        return results
    
    def export_mappings(self, filename: str):
        """Export current mappings to JSON file"""
        config = {
            "cve_mappings": self.nikto_to_cve,
            "cvss_mappings": self.nikto_keyword_cvss
        }
        with open(filename, 'w') as f:
            json.dump(config, f, indent=2)
    
    def get_statistics(self) -> Dict:
        """Get statistics about loaded mappings"""
        return {
            "total_cve_mappings": len(self.nikto_to_cve),
            "total_cvss_mappings": len(self.nikto_keyword_cvss),
            "severity_distribution": {
                "CRITICAL": len([s for s in self.nikto_keyword_cvss.values() if s >= 9.0]),
                "HIGH": len([s for s in self.nikto_keyword_cvss.values() if 7.0 <= s < 9.0]),
                "MEDIUM": len([s for s in self.nikto_keyword_cvss.values() if 4.0 <= s < 7.0]),
                "LOW": len([s for s in self.nikto_keyword_cvss.values() if 0.1 <= s < 4.0]),
                "INFORMATIONAL": len([s for s in self.nikto_keyword_cvss.values() if s == 0.0])
            }
        }

