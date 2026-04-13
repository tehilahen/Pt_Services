# Stitch - סקריפטי בדיקות אבטחה מותאמים אישית

## סקירה כללית

מודול Stitch מאפשר הרצת סקריפטי Python מותאמים אישית לביצוע בדיקות אבטחה על מערכות שונות. זהו תוספת לסריקות Nikto הסטנדרטיות, המאפשרת גמישות רבה יותר בביצוע בדיקות ספציפיות.

## מבנה התיקייה

```
stitch/
├── __init__.py           # נקודת הכניסה למודול
├── README.md             # תיעוד זה
├── stitch_executor.py    # מנוע הרצת הסקריפטים
└── scripts/              # תיקיית הסקריפטים
    ├── __init__.py
    ├── README.md         # הסבר על כתיבת סקריפטים
    └── example_scan.py   # סקריפט לדוגמה
```

## שימוש בסיסי

### הרצת סריקה

```python
from src.stitch import stitch_executor

# הרצת סריקה אסינכרונית
thread = stitch_executor.execute_scan_async(system_id=1, scan_id=123)

# המתנה לסיום
thread.join()
```

### קבלת רשימת סקריפטים זמינים

```python
scripts = stitch_executor.list_available_scripts()
for script in scripts:
    print(f"Script: {script['name']}, Description: {script['description']}")
```

## הוספת סקריפט חדש

1. צור קובץ Python חדש בתיקייה `scripts/`
2. הסקריפט צריך לעמוד בדרישות הבאות:
   - לקבל פרמטרים דרך command line או environment variables
   - להדפיס תוצאות בפורמט JSON
   - להחזיר exit code מתאים

3. דוגמה למבנה סקריפט:

```python
#!/usr/bin/env python3
"""
תיאור הסקריפט
"""
import sys
import json
import argparse

def main():
    parser = argparse.ArgumentParser(description='תיאור')
    parser.add_argument('--target', required=True, help='כתובת היעד')
    args = parser.parse_args()
    
    # ביצוע הבדיקה
    results = perform_scan(args.target)
    
    # הדפסת תוצאות בפורמט JSON
    print(json.dumps(results, ensure_ascii=False, indent=2))
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
```

## פורמט תוצאות

כל סקריפט צריך להחזיר JSON במבנה הבא:

```json
{
  "scan_info": {
    "script_name": "example_scan",
    "target": "https://example.com",
    "start_time": "2024-01-01T10:00:00",
    "end_time": "2024-01-01T10:05:00",
    "status": "completed"
  },
  "vulnerabilities": [
    {
      "description": "תיאור החולשה",
      "severity": "High",
      "cvss": 7.5,
      "cve": "CVE-2024-1234",
      "references": "https://example.com/vuln"
    }
  ],
  "summary": {
    "total_vulnerabilities": 1,
    "critical": 0,
    "high": 1,
    "medium": 0,
    "low": 0
  }
}
```

## אינטגרציה עם המערכת

הסקריפטים מתבצעים דרך ה-API:

```bash
POST /api/scans/initiate
{
  "system_id": 1,
  "scan_source": "Stitch"
}
```

## תיזמון סריקות

ניתן להגדיר סריקות מתוזמנות באמצעות הגדרות סביבה או קונפיגורציה נפרדת.

## אבטחה

- כל הסקריפטים רצים בהרשאות מוגבלות
- אין גישה ישירה למסד הנתונים מהסקריפטים
- כל הפלט מנוקה ומאומת לפני הכנסה למסד הנתונים

## פתרון בעיות

### הסקריפט לא מופיע ברשימה
- ודא שהקובץ נמצא בתיקייה `scripts/`
- ודא שהקובץ הוא `.py` ולא `__init__.py`
- בדוק שיש הרשאות קריאה לקובץ

### הסקריפט נכשל בהרצה
- בדוק את הלוגים ב-`stitch_executor.py`
- ודא שהסקריפט מחזיר JSON תקין
- בדוק שכל התלויות מותקנות

## תרומה

לשאלות או הצעות לשיפור, פנה לצוות הפיתוח.
