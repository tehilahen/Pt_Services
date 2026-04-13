# 📋 מסמך אפיון - מערכת Security Scans
## PT Services - ניהול סריקות אבטחה

**גרסה:** 2.0  
**תאריך:** דצמבר 2024  
**סטטוס:** Production  
**מחלקה:** אגף מערכות מידע - משרד העבודה והרווחה

---

## 📑 תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [מטרות המערכת](#2-מטרות-המערכת)
3. [ארכיטקטורה](#3-ארכיטקטורה)
4. [רכיבי המערכת](#4-רכיבי-המערכת)
5. [דרישות פונקציונליות](#5-דרישות-פונקציונליות)
6. [דרישות לא-פונקציונליות](#6-דרישות-לא-פונקציונליות)
7. [ממשק משתמש](#7-ממשק-משתמש)
8. [API Endpoints](#8-api-endpoints)
9. [מבנה מסד נתונים](#9-מבנה-מסד-נתונים)
10. [אבטחה](#10-אבטחה)
11. [אינטגרציות](#11-אינטגרציות)
12. [תהליכי עבודה](#12-תהליכי-עבודה)

---

## 1. סקירה כללית

### 1.1 תיאור המערכת
מערכת **Security Scans** היא פלטפורמה לניהול סריקות אבטחה ארגוניות. המערכת מאפשרת ביצוע סריקות Nikto על מערכות ארגוניות, ניתוח חולשות, ומעקב אחר סטטוס האבטחה.

### 1.2 קהל היעד

| קהל יעד | תפקיד |
|---------|-------|
| צוות אבטחת מידע | ביצוע וניתוח סריקות |
| מנהלי מערכות | צפייה בחולשות ומעקב תיקונים |
| מפתחים | הבנת חולשות בקוד |
| הנהלה | דוחות וסטטיסטיקות |

### 1.3 היקף הפרויקט
- **Backend:** Python Flask API Server
- **Frontend:** React Single Page Application
- **Scanner:** Nikto Web Vulnerability Scanner (מותאם)
- **Database:** Microsoft SQL Server

---

## 2. מטרות המערכת

### 2.1 מטרות עיקריות
1. ✅ ניהול מרכזי של כל המערכות הארגוניות
2. ✅ ביצוע סריקות אבטחה אוטומטיות
3. ✅ זיהוי וסיווג חולשות לפי חומרה
4. ✅ מעקב אחר תיקון חולשות
5. ✅ דיווח וסטטיסטיקות בזמן אמת

### 2.2 יעדים מדידים

| מדד | יעד |
|-----|-----|
| כיסוי מערכות | 100% מהמערכות הארגוניות |
| תדירות סריקה | פעם בחודש לכל מערכת |
| זמן תגובה לחולשות Critical | 24 שעות |
| דיוק זיהוי | >95% |

---

## 3. ארכיטקטורה

### 3.1 דיאגרמת ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────────┐
│                        משתמשים                                  │
│                     (דפדפן Web)                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (Port 3000)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React)                              │
│     • Dashboard    • Systems    • Scans    • Reports            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API (Port 5000)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Flask)                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ API Server   │ │ Auth Module  │ │ Email Service            │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ CSV Parser   │ │ File Watcher │ │ Nikto Executor           │ │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ ODBC
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SQL Server Database                            │
│     Users | Systems | Scans | Vulnerabilities | PasswordResets  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Nikto Scanner (Perl)                           │
│     • Web Scanning    • CSV Output    • CVSS Integration        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 טכנולוגיות

| שכבה | טכנולוגיה | גרסה |
|------|-----------|------|
| Frontend | React | 18.x |
| Backend | Python Flask | 2.3.0 |
| Database | SQL Server | SQLDEV |
| Scanner | Nikto | 2.5.0 (Custom) |
| SMTP | Internal SMTP | Port 25 |

---

## 4. רכיבי המערכת

### 4.1 Backend Components

| קובץ | תפקיד |
|------|-------|
| `api_server.py` | REST API endpoints |
| `database.py` | חיבור וניהול מסד נתונים |
| `email_service.py` | שליחת מיילים |
| `password_validator.py` | וולידציה לסיסמאות |
| `csv_parser.py` | עיבוד קבצי CSV |
| `file_watcher.py` | מעקב אוטומטי אחר קבצים |
| `nikto_executor.py` | הפעלת סריקות Nikto |
| `nvd_api_client.py` | אינטגרציה עם NVD |
| `cvss_mapper.py` | מיפוי ציוני CVSS |

### 4.2 Frontend Pages

| עמוד | תפקיד |
|------|-------|
| `HomePage.js` | דף בית - סקירה כללית |
| `DashboardPage.js` | דשבורד סטטיסטיקות |
| `AllSystemsPage.js` | רשימת כל המערכות |
| `SystemPageNew.js` | פרטי מערכת בודדת |
| `ScansPage.js` | היסטוריית סריקות |
| `AllVulnerabilitiesPage.js` | כל החולשות |
| `CriticalVulnerabilitiesPage.js` | חולשות קריטיות |
| `HighVulnerabilitiesPage.js` | חולשות High |
| `MediumVulnerabilitiesPage.js` | חולשות Medium |
| `LowVulnerabilitiesPage.js` | חולשות Low |
| `RequestScanPage.js` | בקשת סריקה חדשה |
| `UserManagementPage.js` | ניהול משתמשים |

### 4.3 Shared Components

| רכיב | תפקיד |
|------|-------|
| `Header.js` | כותרת עליונה וניווט |
| `Sidebar.js` | תפריט צד |
| `Footer.js` | כותרת תחתונה |
| `LoginModal.js` | מודל התחברות |

---

## 5. דרישות פונקציונליות

### 5.1 ניהול משתמשים

| מזהה | דרישה | תיאור | עדיפות | סטטוס |
|------|-------|-------|--------|-------|
| FR-001 | התחברות | התחברות עם שם משתמש וסיסמה | חובה | ✅ |
| FR-002 | איפוס סיסמה | איפוס סיסמה באמצעות מייל | חובה | ✅ |
| FR-003 | וולידציית סיסמה | וולידציית סיסמה חזקה (8+ תווים, אותיות, ספרות, תווים מיוחדים) | חובה | ✅ |
| FR-004 | ניהול משתמשים | ניהול משתמשים (Admin) | רצוי | 🔄 |
| FR-005 | התנתקות | התנתקות בטוחה מהמערכת | חובה | ✅ |

### 5.2 ניהול מערכות

| מזהה | דרישה | תיאור | עדיפות | סטטוס |
|------|-------|-------|--------|-------|
| FR-010 | הצגת מערכות | הצגת כל המערכות הארגוניות | חובה | ✅ |
| FR-011 | פרטי מערכת | צפייה בפרטי מערכת בודדת | חובה | ✅ |
| FR-012 | הוספת מערכת | הוספת מערכת חדשה | חובה | ✅ |
| FR-013 | עריכת מערכת | עריכת פרטי מערכת קיימת | רצוי | 🔄 |
| FR-014 | מחיקת מערכת | מחיקת מערכת | רצוי | 🔄 |
| FR-015 | חולשות מערכת | צפייה בחולשות של מערכת ספציפית | חובה | ✅ |

### 5.3 ניהול סריקות

| מזהה | דרישה | תיאור | עדיפות | סטטוס |
|------|-------|-------|--------|-------|
| FR-020 | הפעלת סריקה | הפעלת סריקת Nikto למערכת | חובה | ✅ |
| FR-021 | היסטוריית סריקות | צפייה בהיסטוריית סריקות | חובה | ✅ |
| FR-022 | סטטוס סריקה | מעקב סטטוס סריקה פעילה | חובה | ✅ |
| FR-023 | עיבוד CSV | עיבוד אוטומטי של קבצי CSV מ-Nikto | חובה | ✅ |
| FR-024 | בקשת סריקה | בקשת סריקה חדשה דרך מייל | חובה | ✅ |

### 5.4 ניהול חולשות

| מזהה | דרישה | תיאור | עדיפות | סטטוס |
|------|-------|-------|--------|-------|
| FR-030 | הצגת חולשות | הצגת כל החולשות שנמצאו | חובה | ✅ |
| FR-031 | סינון חומרה | סינון חולשות לפי חומרה (Critical/High/Medium/Low) | חובה | ✅ |
| FR-032 | פרטי חולשה | הצגת פרטי חולשה מלאים | חובה | ✅ |
| FR-033 | CVSS Scoring | הצגת ציון CVSS לכל חולשה | חובה | ✅ |
| FR-034 | אינטגרציית NVD | שליפת מידע נוסף מ-NVD | רצוי | ✅ |

### 5.5 דוחות וסטטיסטיקות

| מזהה | דרישה | תיאור | עדיפות | סטטוס |
|------|-------|-------|--------|-------|
| FR-040 | דשבורד | דשבורד סטטיסטיקות כללי | חובה | ✅ |
| FR-041 | פילוח חומרה | פילוח חולשות לפי חומרה | חובה | ✅ |
| FR-042 | גרפים | גרפים וויזואליזציה | רצוי | 🔄 |
| FR-043 | ייצוא PDF | ייצוא דוחות ל-PDF | עתידי | ⏳ |

---

## 6. דרישות לא-פונקציונליות

### 6.1 ביצועים

| דרישה | יעד | מדידה |
|-------|-----|-------|
| זמן טעינת עמוד | < 2 שניות | מדידה בדפדפן |
| זמן תגובת API | < 500ms | לוגים בשרת |
| עומס מקבילי | עד 50 משתמשים | Load testing |
| זמן סריקה ממוצע | < 30 דקות | תלוי בגודל המערכת |

### 6.2 זמינות

| דרישה | יעד | הערות |
|-------|-----|-------|
| Uptime | 99.5% | בשעות עבודה |
| שעות פעילות | 24/7 | גישה מכל מקום |
| Backup | יומי | גיבוי מסד נתונים |
| Recovery Time | < 4 שעות | RTO |

### 6.3 תאימות

| דרישה | פרטים |
|-------|-------|
| דפדפנים נתמכים | Chrome 90+, Edge 90+, Firefox 85+ |
| רזולוציות | 1920x1080 ומעלה |
| שפה | עברית (RTL) |
| נגישות | WCAG 2.1 AA |

### 6.4 אבטחה (ראה סעיף 10)

---

## 7. ממשק משתמש

### 7.1 עקרונות עיצוב
- **RTL** - תמיכה מלאה בעברית, כיוון מימין לשמאל
- **Responsive** - התאמה למסכים שונים (Desktop first)
- **Accessible** - נגישות מלאה לכלים מסייעים
- **Consistent** - אחידות בעיצוב ובחוויית המשתמש
- **Modern** - עיצוב מודרני ונקי

### 7.2 מבנה הממשק

```
┌────────────────────────────────────────────────────────────┐
│                       Header                                │
│  [Logo]                              [User] [Logout]        │
├──────────────┬─────────────────────────────────────────────┤
│              │                                              │
│   Sidebar    │              Main Content                    │
│              │                                              │
│  • Dashboard │                                              │
│  • Systems   │         [Dynamic Page Content]               │
│  • Scans     │                                              │
│  • Vulns     │                                              │
│  • Request   │                                              │
│              │                                              │
├──────────────┴─────────────────────────────────────────────┤
│                       Footer                                │
│              © Security Scans - v2.0                        │
└────────────────────────────────────────────────────────────┘
```

### 7.3 צבעי חומרה

| חומרה | צבע | Hex Code | שימוש |
|--------|------|----------|-------|
| Critical | אדום כהה | `#8B0000` | חולשות קריטיות |
| High | כתום | `#FF6600` | חולשות גבוהות |
| Medium | צהוב | `#FFD700` | חולשות בינוניות |
| Low | ירוק | `#32CD32` | חולשות נמוכות |
| Info | כחול | `#0066CC` | מידע כללי |

### 7.4 מסכים עיקריים

1. **מסך התחברות** - טופס התחברות + איפוס סיסמה
2. **דשבורד** - סטטיסטיקות כלליות וגרפים
3. **רשימת מערכות** - טבלה עם כל המערכות
4. **פרטי מערכת** - מידע מפורט + חולשות
5. **רשימת סריקות** - היסטוריית סריקות
6. **חולשות** - חולשות לפי חומרה
7. **בקשת סריקה** - טופס בקשה חדשה

---

## 8. API Endpoints

### 8.1 Authentication

| Method | Endpoint | תיאור | Body |
|--------|----------|-------|------|
| POST | `/api/auth/login` | התחברות | `{username, password}` |
| POST | `/api/auth/logout` | התנתקות | - |
| POST | `/api/auth/forgot-password` | בקשת איפוס | `{email}` |
| POST | `/api/auth/reset-password` | ביצוע איפוס | `{token, newPassword}` |

### 8.2 Systems

| Method | Endpoint | תיאור | Response |
|--------|----------|-------|----------|
| GET | `/api/systems` | רשימת מערכות | `[{system}]` |
| GET | `/api/systems/:id` | פרטי מערכת | `{system}` |
| GET | `/api/systems/:id/vulnerabilities` | חולשות מערכת | `[{vuln}]` |

### 8.3 Scans

| Method | Endpoint | תיאור | Body/Response |
|--------|----------|-------|---------------|
| GET | `/api/scans` | רשימת סריקות | `[{scan}]` |
| POST | `/api/scans/initiate` | הפעלת סריקה | `{system_id}` |
| GET | `/api/scans/:id/status` | סטטוס סריקה | `{status}` |
| GET | `/api/scans/:id/vulnerabilities` | חולשות סריקה | `[{vuln}]` |

### 8.4 Vulnerabilities

| Method | Endpoint | תיאור | Response |
|--------|----------|-------|----------|
| GET | `/api/vulnerabilities` | כל החולשות | `[{vuln}]` |

### 8.5 Stats & Utils

| Method | Endpoint | תיאור | Response |
|--------|----------|-------|----------|
| GET | `/api/health` | בדיקת תקינות | `{status: 'ok'}` |
| GET | `/api/stats` | סטטיסטיקות | `{stats}` |
| POST | `/api/scan-request` | בקשת סריקה במייל | `{success}` |
| POST | `/api/process-csv-file` | עיבוד CSV | `{success}` |

### 8.6 Response Format

**הצלחה:**
```json
{
  "success": true,
  "data": {...},
  "message": "הפעולה הצליחה"
}
```

**שגיאה:**
```json
{
  "success": false,
  "error": "תיאור השגיאה",
  "message": "הודעה למשתמש"
}
```

---

## 9. מבנה מסד נתונים

### 9.1 ERD (Entity Relationship Diagram)

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│      Users       │     │     Systems      │     │       Scans         │
├──────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ UserID (PK)      │     │ SystemID (PK)    │◄────│ SystemID (FK)       │
│ UserName         │     │ SystemName       │     │ ScanID (PK)         │
│ Email            │     │ URL              │     │ ScanDate            │
│ Password         │     │ Description      │     │ Status              │
│ UserTypeID       │     │ CreatedDate      │     │ VulnerabilityCount  │
│ CreatedDate      │     │ UpdatedDate      │     │ CreatedDate         │
└────────┬─────────┘     └──────────────────┘     └──────────┬──────────┘
         │                                                    │
         │                                                    ▼
         │                                        ┌─────────────────────┐
         │                                        │   Vulnerabilities   │
         │                                        ├─────────────────────┤
         ▼                                        │ VulnerabilityID (PK)│
┌──────────────────┐                              │ ScanID (FK)         │
│  PasswordResets  │                              │ OSVDBID             │
├──────────────────┤                              │ Description         │
│ ResetID (PK)     │                              │ CVSSScore           │
│ UserID (FK)      │                              │ Severity            │
│ Token            │                              │ URI                 │
│ CreatedAt        │                              │ Method              │
│ ExpiresAt        │                              │ References          │
│ Used             │                              │ CreatedDate         │
└──────────────────┘                              └─────────────────────┘
```

### 9.2 פירוט טבלאות

#### טבלת Users
| שדה | סוג | תיאור |
|-----|-----|-------|
| UserID | INT (PK) | מזהה ייחודי |
| UserName | NVARCHAR(50) | שם משתמש |
| Email | NVARCHAR(100) | כתובת אימייל |
| Password | NVARCHAR(255) | סיסמה מוצפנת (scrypt) |
| UserTypeID | INT | סוג משתמש (1=Admin, 2=User) |
| CreatedDate | DATETIME | תאריך יצירה |

#### טבלת Systems
| שדה | סוג | תיאור |
|-----|-----|-------|
| SystemID | INT (PK) | מזהה ייחודי |
| SystemName | NVARCHAR(100) | שם המערכת |
| URL | NVARCHAR(255) | כתובת URL |
| Description | NVARCHAR(500) | תיאור המערכת |
| CreatedDate | DATETIME | תאריך יצירה |
| UpdatedDate | DATETIME | תאריך עדכון |

#### טבלת Scans
| שדה | סוג | תיאור |
|-----|-----|-------|
| ScanID | INT (PK) | מזהה ייחודי |
| SystemID | INT (FK) | מזהה מערכת |
| ScanDate | DATETIME | תאריך סריקה |
| Status | NVARCHAR(20) | סטטוס (Running/Completed/Failed) |
| VulnerabilityCount | INT | מספר חולשות |
| CreatedDate | DATETIME | תאריך יצירה |

#### טבלת Vulnerabilities
| שדה | סוג | תיאור |
|-----|-----|-------|
| VulnerabilityID | INT (PK) | מזהה ייחודי |
| ScanID | INT (FK) | מזהה סריקה |
| OSVDBID | NVARCHAR(20) | מזהה OSVDB |
| Description | NVARCHAR(MAX) | תיאור החולשה |
| CVSSScore | DECIMAL(3,1) | ציון CVSS (0-10) |
| Severity | NVARCHAR(20) | חומרה |
| URI | NVARCHAR(500) | נתיב שנמצא |
| Method | NVARCHAR(10) | שיטת HTTP |
| References | NVARCHAR(MAX) | קישורים |
| CreatedDate | DATETIME | תאריך יצירה |

#### טבלת PasswordResets
| שדה | סוג | תיאור |
|-----|-----|-------|
| ResetID | INT (PK) | מזהה ייחודי |
| UserID | INT (FK) | מזהה משתמש |
| Token | NVARCHAR(64) | טוקן איפוס (32 תווים) |
| CreatedAt | DATETIME | תאריך יצירה |
| ExpiresAt | DATETIME | תאריך תפוגה (24 שעות) |
| Used | BIT | האם נוצל (0/1) |

---

## 10. אבטחה

### 10.1 הגנות מובנות

| הגנה | טכנולוגיה | פירוט |
|------|-----------|--------|
| Password Hashing | Werkzeug (scrypt) | הצפנה עם salt אוטומטי |
| SQL Injection | Parameterized Queries | כל השאילתות עם פרמטרים |
| CORS | Flask-CORS | Origins מוגדרים בלבד |
| Token Security | secrets module | 32 תווים אקראיים |
| Input Validation | Regex + sanitization | וולידציה כפולה |
| Session Management | Flask Sessions | מפתח סודי |

### 10.2 דרישות סיסמה

| דרישה | פירוט | Regex |
|-------|-------|-------|
| אורך מינימלי | 8 תווים לפחות | `.{8,}` |
| אות גדולה | לפחות אחת A-Z | `[A-Z]` |
| אות קטנה | לפחות אחת a-z | `[a-z]` |
| ספרה | לפחות אחת 0-9 | `[0-9]` |
| תו מיוחד | לפחות אחד !@#$%^&* | `[!@#$%^&*]` |

### 10.3 טוקני איפוס סיסמה

| מאפיין | ערך |
|--------|-----|
| אורך | 32 תווים |
| אלגוריתם | secrets.token_urlsafe |
| תוקף | 24 שעות |
| שימוש | חד-פעמי |
| אחסון | מסד נתונים (לא Session) |

### 10.4 CORS Configuration

```python
CORS_ORIGINS = [
    'https://pt-services.molsa.gov.il',  # Production
    'http://localhost:3000'               # Development
]
```

### 10.5 המלצות לפרודקשן

| המלצה | סטטוס | עדיפות |
|-------|-------|--------|
| FLASK_DEBUG=False | חובה | קריטי |
| HTTPS בלבד | חובה | קריטי |
| WSGI Server (Gunicorn) | חובה | גבוה |
| Rate Limiting | מומלץ | בינוני |
| Firewall Rules | חובה | גבוה |
| Regular Backups | חובה | גבוה |
| Security Headers | מומלץ | בינוני |
| Audit Logging | מומלץ | בינוני |

---

## 11. אינטגרציות

### 11.1 Nikto Scanner

**תיאור:** סורק חולשות Web מותאם עם תמיכה ב-CVSS

**מיקום:** `PT_Service_Nikto/`

**פלאגינים מותאמים:**
| פלאגין | תפקיד |
|--------|-------|
| `nikto_cvss_integration.plugin` | שילוב ציוני CVSS |
| `nikto_report_csv_cvss.plugin` | דוחות CSV עם CVSS |
| `nikto_core_cvss.plugin` | ליבת חישוב CVSS |

**פורמט פלט:**
```csv
"hostname","ip","port","osvdb","method","uri","description","cvss_score","severity"
```

### 11.2 NVD (National Vulnerability Database)

**תיאור:** אינטגרציה עם מסד הנתונים הלאומי לחולשות של NIST

**רכיבים:**
| קובץ | תפקיד |
|------|-------|
| `nvd_api_client.py` | לקוח API בסיסי |
| `enhanced_nvd_client.py` | לקוח מורחב עם מטמון |
| `nvd_cache.db` | מטמון SQLite מקומי |

**שימוש:** העשרת מידע על חולשות עם CVE IDs ופרטים נוספים

### 11.3 SMTP Email Service

**תיאור:** שליחת מיילים לאיפוס סיסמה ובקשות סריקה

**הגדרות ברירת מחדל:**
```env
SMTP_SERVER=10.23.254.200
SMTP_PORT=25
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
```

**תבניות מייל:**
- מייל איפוס סיסמה (HTML + RTL)
- מייל בקשת סריקה (HTML מפורט)

---

## 12. תהליכי עבודה

### 12.1 תהליך התחברות

```
[משתמש] ──► [Login Form] ──► [POST /api/auth/login]
                                      │
                                      ▼
                            [Validate Credentials]
                                      │
                                ┌─────┴─────┐
                                ▼           ▼
                            [Success]   [Failure]
                                │           │
                                ▼           ▼
                          [Set Session] [Error 401]
                                │           │
                                ▼           ▼
                          [Redirect]  [Show Error]
```

### 12.2 תהליך איפוס סיסמה

```
שלב 1: בקשת איפוס
[משתמש] ──► [Forgot Password] ──► [POST /api/auth/forgot-password]
                                           │
                                           ▼
                               [Find User by Email]
                                           │
                                           ▼
                               [Generate Token (32 chars)]
                                           │
                                           ▼
                               [Save Token to DB (24h TTL)]
                                           │
                                           ▼
                               [Send Email with Token]

שלב 2: ביצוע איפוס
[משתמש] ──► [Enter Token + New Password] ──► [POST /api/auth/reset-password]
                                                       │
                                                       ▼
                                           [Validate Token (not expired, not used)]
                                                       │
                                                       ▼
                                           [Validate Password Strength]
                                                       │
                                                       ▼
                                           [Hash New Password (scrypt)]
                                                       │
                                                       ▼
                                           [Update User Password]
                                                       │
                                                       ▼
                                           [Mark Token as Used]
                                                       │
                                                       ▼
                                           [Success - Redirect to Login]
```

### 12.3 תהליך סריקה

```
[Request Scan] ──► [POST /api/scans/initiate]
                           │
                           ▼
                   [Create Scan Record (Status: Running)]
                           │
                           ▼
                   [Start Nikto Executor (Background)]
                           │
                           ▼
                   [Execute: nikto.pl -host {url} -output {csv}]
                           │
                           ▼
                   [Generate CSV with CVSS Scores]
                           │
                           ▼
                   [File Watcher Detects New CSV]
                           │
                           ▼
                   [CSV Parser Processes File]
                           │
                           ▼
                   [Insert Vulnerabilities to DB]
                           │
                           ▼
                   [Update Scan Record (Status: Completed)]
                           │
                           ▼
                   [Move CSV to Archive Folder]
```

### 12.4 תהליך בקשת סריקה

```
[משתמש] ──► [Request Scan Form] ──► [POST /api/scan-request]
                                            │
                                            ▼
                                    [Validate Form Data]
                                            │
                                            ▼
                                    [Build HTML Email]
                                            │
                                            ▼
                                    [Send to Security Team]
                                            │
                                            ▼
                                    [Return Success]
                                            │
                                            ▼
                                    [Clear Form]
```

---

## 📎 נספחים

### נספח א': קבצי הגדרה

**`.env` (לא בגרסיה):**
```env
# Database - SQL Server Authentication (שם משתמש וסיסמה)
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=SQLDEV;Database=SA_DTI_Security_NiktoWebServerScanner;UID=ptuser;PWD=YOUR_PASSWORD;TrustServerCertificate=yes;

# Flask
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=True
SECRET_KEY=your-secret-key

# SMTP
SMTP_SERVER=10.23.254.200
SMTP_PORT=25
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il

# CORS
CORS_ORIGINS=https://pt-services.molsa.gov.il,http://localhost:3000
```

### נספח ב': תלויות

**Backend (requirements.txt):**
```
Flask==2.3.0
Flask-CORS==4.0.0
pyodbc==4.0.39
werkzeug==2.3.0
python-dotenv==1.0.0
pandas==2.0.3
watchdog==3.0.0
```

**Frontend (package.json):**
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-router-dom": "^6.x",
    "@mui/material": "^5.x"
  }
}
```

---

## 📞 אנשי קשר

| תפקיד | שם | אימייל |
|-------|-----|--------|
| תמיכה טכנית | אסף ו. | AsafV@molsa.gov.il |
| מחלקת IT | - | לפי נוהל ארגוני |

---

## 📝 היסטוריית גרסאות מסמך

| גרסה | תאריך | שינויים | עורך |
|------|-------|----------|------|
| 2.0 | דצמבר 2024 | מסמך ראשוני מלא | אוטומטי |

---

## 📚 מסמכים קשורים

- [📚 START_HERE.md](./📚_START_HERE.md) - נקודת התחלה
- [README.md](./README.md) - תיעוד טכני
- [USER_GUIDE.md](./USER_GUIDE.md) - מדריך למשתמש
- [EMAIL_CONFIG.md](./EMAIL_CONFIG.md) - הגדרת מיילים
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - רשימת פריסה
- [CHANGELOG.md](./CHANGELOG.md) - היסטוריית שינויים

---



