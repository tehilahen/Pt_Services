#!/usr/bin/env python3
"""
סקריפט לדוגמה לבדיקת אבטחה - Stitch Example Scan

סקריפט זה מבצע בדיקות אבטחה בסיסיות על אתר web:
1. בדיקת HTTP Security Headers
2. בדיקת פרוטוקול SSL/TLS
3. בדיקת הגדרות Cookie
4. בדיקת חשיפת מידע רגיש

שימוש:
    python example_scan.py --target https://example.com
    python example_scan.py --target https://example.com --timeout 60
"""

import sys
import json
import argparse
import requests
import urllib3
from datetime import datetime
from urllib.parse import urlparse

# השבתת אזהרות SSL (רק לצורכי בדיקה)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def check_security_headers(url, timeout=30):
    """
    בדיקת HTTP Security Headers
    
    Args:
        url (str): כתובת URL לבדיקה
        timeout (int): זמן המתנה מקסימלי
        
    Returns:
        list: רשימת חולשות שנמצאו
    """
    vulnerabilities = []
    
    try:
        response = requests.get(url, timeout=timeout, verify=False)
        
        # Headers חשובים לאבטחה
        security_headers = {
            'X-Frame-Options': {
                'severity': 'Medium',
                'cvss': 5.0,
                'description': 'חסר הגנה מפני Clickjacking - X-Frame-Options'
            },
            'X-Content-Type-Options': {
                'severity': 'Low',
                'cvss': 3.0,
                'description': 'חסר הגנה מפני MIME sniffing - X-Content-Type-Options'
            },
            'Strict-Transport-Security': {
                'severity': 'High',
                'cvss': 7.0,
                'description': 'חסר HSTS - Strict-Transport-Security'
            },
            'Content-Security-Policy': {
                'severity': 'Medium',
                'cvss': 5.5,
                'description': 'חסר CSP - Content-Security-Policy'
            },
            'X-XSS-Protection': {
                'severity': 'Low',
                'cvss': 3.5,
                'description': 'חסר הגנה מפני XSS - X-XSS-Protection'
            },
            'Referrer-Policy': {
                'severity': 'Low',
                'cvss': 2.5,
                'description': 'חסר Referrer-Policy'
            }
        }
        
        for header, info in security_headers.items():
            if header not in response.headers:
                vulnerabilities.append({
                    'description': info['description'],
                    'severity': info['severity'],
                    'cvss': info['cvss'],
                    'cve': None,
                    'references': f'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/{header}'
                })
        
        # בדיקת חשיפת מידע בheaders
        sensitive_headers = ['Server', 'X-Powered-By', 'X-AspNet-Version']
        for header in sensitive_headers:
            if header in response.headers:
                vulnerabilities.append({
                    'description': f'חשיפת מידע רגיש בheader: {header} = {response.headers[header]}',
                    'severity': 'Low',
                    'cvss': 2.0,
                    'cve': None,
                    'references': 'Information disclosure through HTTP headers'
                })
                
    except requests.exceptions.Timeout:
        vulnerabilities.append({
            'description': f'Timeout בבדיקת headers - השרת לא הגיב תוך {timeout} שניות',
            'severity': 'Low',
            'cvss': 1.0,
            'cve': None,
            'references': 'Server timeout'
        })
    except requests.exceptions.RequestException as e:
        vulnerabilities.append({
            'description': f'שגיאה בבדיקת headers: {str(e)}',
            'severity': 'Low',
            'cvss': 1.0,
            'cve': None,
            'references': 'Request error'
        })
    
    return vulnerabilities


def check_ssl_configuration(url):
    """
    בדיקת הגדרות SSL/TLS
    
    Args:
        url (str): כתובת URL לבדיקה
        
    Returns:
        list: רשימת חולשות שנמצאו
    """
    vulnerabilities = []
    
    parsed_url = urlparse(url)
    if parsed_url.scheme != 'https':
        vulnerabilities.append({
            'description': 'האתר לא משתמש ב-HTTPS - תעבורה לא מוצפנת',
            'severity': 'Critical',
            'cvss': 9.0,
            'cve': None,
            'references': 'Unencrypted HTTP traffic'
        })
    
    return vulnerabilities


def check_cookie_security(url, timeout=30):
    """
    בדיקת הגדרות אבטחה של Cookies
    
    Args:
        url (str): כתובת URL לבדיקה
        timeout (int): זמן המתנה מקסימלי
        
    Returns:
        list: רשימת חולשות שנמצאו
    """
    vulnerabilities = []
    
    try:
        response = requests.get(url, timeout=timeout, verify=False)
        
        for cookie in response.cookies:
            # בדיקת Secure flag
            if not cookie.secure and urlparse(url).scheme == 'https':
                vulnerabilities.append({
                    'description': f'Cookie "{cookie.name}" חסר Secure flag',
                    'severity': 'Medium',
                    'cvss': 5.0,
                    'cve': None,
                    'references': 'Cookie without Secure flag'
                })
            
            # בדיקת HttpOnly flag
            if not cookie.has_nonstandard_attr('HttpOnly'):
                vulnerabilities.append({
                    'description': f'Cookie "{cookie.name}" חסר HttpOnly flag',
                    'severity': 'Medium',
                    'cvss': 5.5,
                    'cve': None,
                    'references': 'Cookie without HttpOnly flag - vulnerable to XSS'
                })
                
    except requests.exceptions.RequestException:
        pass  # כבר טופל בפונקציה הקודמת
    
    return vulnerabilities


def check_information_disclosure(url, timeout=30):
    """
    בדיקת חשיפת מידע רגיש
    
    Args:
        url (str): כתובת URL לבדיקה
        timeout (int): זמן המתנה מקסימלי
        
    Returns:
        list: רשימת חולשות שנמצאו
    """
    vulnerabilities = []
    
    try:
        response = requests.get(url, timeout=timeout, verify=False)
        content = response.text.lower()
        
        # דפוסים של מידע רגיש
        sensitive_patterns = {
            'password': 'חשיפת מילת סיסמה בתוכן הדף',
            'api_key': 'חשיפת API key בתוכן הדף',
            'secret': 'חשיפת secret בתוכן הדף',
            'token': 'חשיפת token בתוכן הדף',
            'private_key': 'חשיפת private key בתוכן הדף'
        }
        
        for pattern, description in sensitive_patterns.items():
            if pattern in content:
                vulnerabilities.append({
                    'description': description,
                    'severity': 'High',
                    'cvss': 7.5,
                    'cve': None,
                    'references': 'Sensitive information disclosure'
                })
                
    except requests.exceptions.RequestException:
        pass  # כבר טופל בפונקציה הקודמת
    
    return vulnerabilities


def perform_scan(target_url, timeout=30):
    """
    ביצוע סריקה מלאה
    
    Args:
        target_url (str): כתובת URL של היעד
        timeout (int): זמן המתנה מקסימלי
        
    Returns:
        dict: תוצאות הסריקה
    """
    start_time = datetime.now()
    all_vulnerabilities = []
    
    # ביצוע כל הבדיקות
    all_vulnerabilities.extend(check_security_headers(target_url, timeout))
    all_vulnerabilities.extend(check_ssl_configuration(target_url))
    all_vulnerabilities.extend(check_cookie_security(target_url, timeout))
    all_vulnerabilities.extend(check_information_disclosure(target_url, timeout))
    
    end_time = datetime.now()
    
    # חישוב סיכום
    summary = {
        'total_vulnerabilities': len(all_vulnerabilities),
        'critical': sum(1 for v in all_vulnerabilities if v['severity'] == 'Critical'),
        'high': sum(1 for v in all_vulnerabilities if v['severity'] == 'High'),
        'medium': sum(1 for v in all_vulnerabilities if v['severity'] == 'Medium'),
        'low': sum(1 for v in all_vulnerabilities if v['severity'] == 'Low')
    }
    
    return {
        'scan_info': {
            'script_name': 'example_scan',
            'target': target_url,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'duration_seconds': (end_time - start_time).total_seconds(),
            'status': 'completed'
        },
        'vulnerabilities': all_vulnerabilities,
        'summary': summary
    }


def main():
    """נקודת הכניסה הראשית"""
    parser = argparse.ArgumentParser(
        description='סקריפט לדוגמה לבדיקת אבטחת אתרים - Stitch Example Scan',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
דוגמאות שימוש:
  python example_scan.py --target https://example.com
  python example_scan.py --target https://example.com --timeout 60
        """
    )
    
    parser.add_argument(
        '--target',
        required=True,
        help='כתובת URL של היעד לסריקה (לדוגמה: https://example.com)'
    )
    
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='זמן המתנה מקסימלי בשניות (ברירת מחדל: 30)'
    )
    
    args = parser.parse_args()
    
    # וולידציה של URL
    if not args.target.startswith(('http://', 'https://')):
        print(json.dumps({
            'scan_info': {
                'script_name': 'example_scan',
                'target': args.target,
                'status': 'failed',
                'error': 'URL חייב להתחיל ב-http:// או https://'
            },
            'vulnerabilities': [],
            'summary': {'total_vulnerabilities': 0}
        }, ensure_ascii=False, indent=2))
        return 2
    
    try:
        # ביצוע הסריקה
        results = perform_scan(args.target, args.timeout)
        
        # הדפסת התוצאות בפורמט JSON
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0
        
    except Exception as e:
        # טיפול בשגיאות לא צפויות
        error_result = {
            'scan_info': {
                'script_name': 'example_scan',
                'target': args.target,
                'status': 'failed',
                'error': str(e)
            },
            'vulnerabilities': [],
            'summary': {'total_vulnerabilities': 0}
        }
        print(json.dumps(error_result, ensure_ascii=False, indent=2))
        return 1


if __name__ == '__main__':
    sys.exit(main())
