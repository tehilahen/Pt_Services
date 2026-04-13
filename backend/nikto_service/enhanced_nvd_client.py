#!/usr/bin/env python3
"""
Enhanced NVD API Client for Nikto CVSS Integration
Extends the basic NVD client with caching, batch processing, and CVSS-specific features

Usage:
    from enhanced_nvd_client import EnhancedNVDClient
    client = EnhancedNVDClient()
    result = client.get_cvss_for_cve("CVE-2021-44228")
"""

import json
import requests
import time
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import sqlite3
from dataclasses import dataclass, asdict
import hashlib
from nvd_api_client import query_nvd_api, extract_nvd_info

@dataclass
class CachedCVEData:
    """Cached CVE data structure"""
    cve_id: str
    cvss_v3_score: float
    cvss_v3_severity: str
    cvss_v3_vector: str
    description: str
    published_date: str
    last_modified_date: str
    cached_timestamp: str
    
class EnhancedNVDClient:
    """Enhanced NVD API client with caching and batch processing"""
    
    def __init__(self, cache_db: str = "nvd_cache.db", cache_ttl_hours: int = 24):
        """
        Initialize enhanced NVD client
        
        Args:
            cache_db: SQLite database file for caching
            cache_ttl_hours: Cache time-to-live in hours
        """
        self.cache_db = cache_db
        self.cache_ttl = timedelta(hours=cache_ttl_hours)
        self.init_cache_db()
        
        # Rate limiting for NVD API
        self.last_request_time = 0
        self.min_request_interval = 0.6  # 600ms between requests (100 requests per minute max)
    
    def init_cache_db(self):
        """Initialize SQLite cache database"""
        conn = sqlite3.connect(self.cache_db)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cve_cache (
                cve_id TEXT PRIMARY KEY,
                cvss_v3_score REAL,
                cvss_v3_severity TEXT,
                cvss_v3_vector TEXT,
                description TEXT,
                published_date TEXT,
                last_modified_date TEXT,
                cached_timestamp TEXT
            )
        ''')
        
        # Create index for faster lookups
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cve_id ON cve_cache(cve_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_cached_timestamp ON cve_cache(cached_timestamp)')
        
        conn.commit()
        conn.close()
    
    def is_cache_valid(self, cached_timestamp: str) -> bool:
        """Check if cached data is still valid"""
        try:
            cached_time = datetime.fromisoformat(cached_timestamp)
            return datetime.now() - cached_time < self.cache_ttl
        except:
            return False
    
    def get_cached_cve(self, cve_id: str) -> Optional[CachedCVEData]:
        """Get CVE data from cache if available and valid"""
        conn = sqlite3.connect(self.cache_db)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM cve_cache WHERE cve_id = ?', (cve_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            cached_data = CachedCVEData(
                cve_id=row[0],
                cvss_v3_score=row[1] or 0.0,
                cvss_v3_severity=row[2] or "",
                cvss_v3_vector=row[3] or "",
                description=row[4] or "",
                published_date=row[5] or "",
                last_modified_date=row[6] or "",
                cached_timestamp=row[7]
            )
            
            if self.is_cache_valid(cached_data.cached_timestamp):
                return cached_data
        
        return None
    
    def cache_cve_data(self, cve_data: Dict):
        """Cache CVE data in SQLite database"""
        conn = sqlite3.connect(self.cache_db)
        cursor = conn.cursor()
        
        cached_data = CachedCVEData(
            cve_id=cve_data.get('cve_id', ''),
            cvss_v3_score=float(cve_data.get('cvss_v3_score', 0.0)) if cve_data.get('cvss_v3_score') else 0.0,
            cvss_v3_severity=cve_data.get('cvss_v3_severity', ''),
            cvss_v3_vector=cve_data.get('cvss_v3_vector', ''),
            description=cve_data.get('description', ''),
            published_date=cve_data.get('published_date', ''),
            last_modified_date=cve_data.get('last_modified_date', ''),
            cached_timestamp=datetime.now().isoformat()
        )
        
        cursor.execute('''
            INSERT OR REPLACE INTO cve_cache 
            (cve_id, cvss_v3_score, cvss_v3_severity, cvss_v3_vector, description, 
             published_date, last_modified_date, cached_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            cached_data.cve_id,
            cached_data.cvss_v3_score,
            cached_data.cvss_v3_severity,
            cached_data.cvss_v3_vector,
            cached_data.description,
            cached_data.published_date,
            cached_data.last_modified_date,
            cached_data.cached_timestamp
        ))
        
        conn.commit()
        conn.close()
    
    def rate_limit(self):
        """Implement rate limiting for NVD API requests"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        
        if time_since_last_request < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last_request
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def get_cvss_for_cve(self, cve_id: str) -> Optional[Dict]:
        """
        Get CVSS information for a CVE ID with caching
        
        Args:
            cve_id: CVE identifier (e.g., "CVE-2021-44228")
            
        Returns:
            Dictionary with CVSS information or None if not found
        """
        # Check cache first
        cached_data = self.get_cached_cve(cve_id)
        if cached_data:
            return asdict(cached_data)
        
        # Rate limit API requests
        self.rate_limit()
        
        # Query NVD API
        try:
            nvd_data = query_nvd_api(cve_id)
            if nvd_data:
                # Cache the result
                self.cache_cve_data(nvd_data)
                return nvd_data
        except Exception as e:
            print(f"Error querying NVD for {cve_id}: {e}")
        
        return None
    
    def batch_get_cvss(self, cve_ids: List[str], max_batch_size: int = 50) -> Dict[str, Dict]:
        """
        Get CVSS information for multiple CVE IDs
        
        Args:
            cve_ids: List of CVE identifiers
            max_batch_size: Maximum number of CVEs to process in one batch
            
        Returns:
            Dictionary mapping CVE IDs to their CVSS information
        """
        results = {}
        
        # Process in batches to avoid overwhelming the API
        for i in range(0, len(cve_ids), max_batch_size):
            batch = cve_ids[i:i + max_batch_size]
            
            for cve_id in batch:
                result = self.get_cvss_for_cve(cve_id)
                if result:
                    results[cve_id] = result
            
            # Add delay between batches
            if i + max_batch_size < len(cve_ids):
                time.sleep(1)
        
        return results
    
    def cleanup_cache(self, max_age_days: int = 30):
        """Clean up old cache entries"""
        conn = sqlite3.connect(self.cache_db)
        cursor = conn.cursor()
        
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        cursor.execute('DELETE FROM cve_cache WHERE cached_timestamp < ?', (cutoff_date.isoformat(),))
        
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        print(f"Cleaned up {deleted_count} old cache entries")
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        conn = sqlite3.connect(self.cache_db)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM cve_cache')
        total_entries = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM cve_cache WHERE cached_timestamp > ?', 
                      ((datetime.now() - self.cache_ttl).isoformat(),))
        valid_entries = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_entries": total_entries,
            "valid_entries": valid_entries,
            "cache_hit_ratio": valid_entries / max(total_entries, 1),
            "cache_ttl_hours": self.cache_ttl.total_seconds() / 3600
        }

def main():
    """Test the enhanced NVD client"""
    client = EnhancedNVDClient()
    
    # Test single CVE lookup
    print("=== Testing Single CVE Lookup ===")
    cve_data = client.get_cvss_for_cve("CVE-2021-44228")
    if cve_data:
        print(f"CVE: {cve_data['cve_id']}")
        print(f"CVSS Score: {cve_data['cvss_v3_score']}")
        print(f"Severity: {cve_data['cvss_v3_severity']}")
    
    # Test batch lookup
    print("\n=== Testing Batch CVE Lookup ===")
    test_cves = ["CVE-2021-44228", "CVE-2019-11043", "CVE-2020-1472"]
    batch_results = client.batch_get_cvss(test_cves)
    
    for cve_id, data in batch_results.items():
        print(f"{cve_id}: Score {data['cvss_v3_score']}, Severity {data['cvss_v3_severity']}")
    
    # Show cache statistics
    print("\n=== Cache Statistics ===")
    stats = client.get_cache_stats()
    print(f"Total entries: {stats['total_entries']}")
    print(f"Valid entries: {stats['valid_entries']}")
    print(f"Cache hit ratio: {stats['cache_hit_ratio']:.2%}")

if __name__ == "__main__":
    main()

