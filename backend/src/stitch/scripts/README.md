# מדריך לכתיבת סקריפטי Stitch

## דרישות בסיסיות

כל סקריפט Stitch צריך לעמוד בדרישות הבאות:

### 1. מבנה הסקריפט

```python
#!/usr/bin/env python3
"""
תיאור הסקריפט - מה הוא בודק ואיך
"""
import sys
import json
import argparse
from datetime import datetime

def perform_scan(target_url):
    """
    ביצוע הסריקה בפועל
    
    Args:
        target_url (str): כתובת URL של היעד
        
    Returns:
        dict: תוצאות הסריקה
    """
    vulnerabilities = []
    
    # כאן מתבצעת הבדיקה בפועל
    # לדוגמה: בדיקת headers, בדיקת SSL, וכו'
    
    return {
        "scan_info": {
            "script_name": "my_scan",
            "target": target_url,
            "start_time": datetime.now().isoformat(),
            "status": "completed"
        },
        "vulnerabilities": vulnerabilities,
        "summary": {
            "total_vulnerabilities": len(vulnerabilities)
        }
    }

def main():
    parser = argparse.ArgumentParser(
        description='תיאור הסקריפט'
    )
    parser.add_argument(
        '--target',
        required=True,
        help='כתובת URL של היעד לסריקה'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='זמן המתנה מקסימלי בשניות'
    )
    
    args = parser.parse_args()
    
    try:
        results = perform_scan(args.target)
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0
    except Exception as e:
        error_result = {
            "scan_info": {
                "script_name": "my_scan",
                "target": args.target,
                "status": "failed",
                "error": str(e)
            },
            "vulnerabilities": [],
            "summary": {"total_vulnerabilities": 0}
        }
        print(json.dumps(error_result, ensure_ascii=False, indent=2))
        return 1

if __name__ == '__main__':
    sys.exit(main())
```

### 2. פורמט פלט JSON

הפלט חייב להיות JSON תקין עם המבנה הבא:

```json
{
  "scan_info": {
    "script_name": "שם הסקריפט",
    "target": "https://example.com",
    "start_time": "2024-01-01T10:00:00",
    "end_time": "2024-01-01T10:05:00",
    "status": "completed|failed",
    "error": "הודעת שגיאה (אופציונלי)"
  },
  "vulnerabilities": [
    {
      "description": "תיאור החולשה",
      "severity": "Critical|High|Medium|Low",
      "cvss": 7.5,
      "cve": "CVE-2024-1234",
      "references": "קישורים למידע נוסף"
    }
  ],
  "summary": {
    "total_vulnerabilities": 5,
    "critical": 1,
    "high": 2,
    "medium": 1,
    "low": 1
  }
}
```

### 3. רמות חומרה (Severity)

השתמש באחת מהרמות הבאות:
- `Critical` - קריטי
- `High` - גבוה
- `Medium` - בינוני
- `Low` - נמוך

### 4. Exit Codes

- `0` - הסריקה הושלמה בהצלחה
- `1` - שגיאה כללית
- `2` - שגיאה בפרמטרים
- `3` - שגיאת timeout

## דוגמאות לסוגי בדיקות

### בדיקת HTTP Headers

```python
import requests

def check_security_headers(url):
    vulnerabilities = []
    response = requests.get(url, timeout=10)
    
    required_headers = {
        'X-Frame-Options': 'חסר הגנה מפני Clickjacking',
        'X-Content-Type-Options': 'חסר הגנה מפני MIME sniffing',
        'Strict-Transport-Security': 'חסר HSTS',
        'Content-Security-Policy': 'חסר CSP'
    }
    
    for header, description in required_headers.items():
        if header not in response.headers:
            vulnerabilities.append({
                "description": f"{description}: {header}",
                "severity": "Medium",
                "cvss": 5.0,
                "references": f"https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/{header}"
            })
    
    return vulnerabilities
```

### בדיקת SSL/TLS

```python
import ssl
import socket

def check_ssl_configuration(hostname):
    vulnerabilities = []
    context = ssl.create_default_context()
    
    try:
        with socket.create_connection((hostname, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                protocol = ssock.version()
                
                # בדיקת פרוטוקול ישן
                if protocol in ['TLSv1', 'TLSv1.1']:
                    vulnerabilities.append({
                        "description": f"שימוש בפרוטוקול TLS לא מאובטח: {protocol}",
                        "severity": "High",
                        "cvss": 7.5
                    })
    except Exception as e:
        vulnerabilities.append({
            "description": f"שגיאה בבדיקת SSL: {str(e)}",
            "severity": "Medium",
            "cvss": 5.0
        })
    
    return vulnerabilities
```

### בדיקת Ports פתוחים

```python
import socket

def scan_common_ports(hostname):
    vulnerabilities = []
    dangerous_ports = {
        21: 'FTP',
        23: 'Telnet',
        3389: 'RDP',
        5432: 'PostgreSQL',
        3306: 'MySQL'
    }
    
    for port, service in dangerous_ports.items():
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((hostname, port))
        sock.close()
        
        if result == 0:
            vulnerabilities.append({
                "description": f"פורט {port} ({service}) פתוח ונגיש",
                "severity": "High",
                "cvss": 7.0,
                "references": f"Port {port} should be closed or firewalled"
            })
    
    return vulnerabilities
```

## טיפים לפיתוח

1. **תמיד השתמש ב-timeout** - כדי למנוע תלייה של הסריקה
2. **טפל בשגיאות** - תפוס exceptions והחזר JSON תקין גם במקרה של שגיאה
3. **תעד את הקוד** - הוסף הערות והסברים
4. **בדוק את הקלט** - ודא שה-URL או הפרמטרים תקינים
5. **הגבל משאבים** - אל תשתמש בזיכרון או CPU מוגזם

## בדיקת הסקריפט

לפני הוספת הסקריפט למערכת, בדוק אותו ידנית:

```bash
python my_scan.py --target https://example.com
```

ודא שהפלט הוא JSON תקין:

```bash
python my_scan.py --target https://example.com | python -m json.tool
```

## תלויות נפוצות

הספריות הבאות זמינות בסביבת הריצה:

- `requests` - לבקשות HTTP
- `urllib3` - לבקשות ברמה נמוכה יותר
- `json` - לעבודה עם JSON
- `argparse` - לפרמטרי command line
- `datetime` - לעבודה עם תאריכים

אם אתה צריך ספרייה נוספת, פנה לצוות הפיתוח.
