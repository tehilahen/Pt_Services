# 🛡️ PT Services Backend - מערכת Security Scans

שרת Backend ב-Python Flask לניהול סריקות אבטחה, חולשות ומשתמשים.

## 🚀 הפעלה מהירה

### דרישות מערכת
- Python 3.8+
- SQL Server (SQLDEV)
- ODBC Driver 17 for SQL Server
- שרת SMTP (לשליחת מיילים)

### התקנה והפעלה

#### שלב 1: התקנת תלויות Python
```bash
pip install -r requirements.txt
```

#### שלב 2: הקמת מסד נתונים (על ידי DBA)
```sql
-- הרץ את הסקריפטים הבאים בסדר:
-- 1. יצירת כל הטבלאות
sql/init_tables.sql

-- 2. יצירת משתמש Admin ראשוני (לאחר עדכון הסיסמה המוצפנת)
sql/seed_admin_user.sql
```

#### שלב 3: הגדרת משתני סביבה
צור קובץ `.env` בתיקייה הראשית:
```env
# ============================================
# חיבור למסד נתונים
# ============================================
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=SQLDEV;Database=SA_DTI_Security_NiktoWebServerScanner;UID=ptuser;PWD=YOUR_PASSWORD;TrustServerCertificate=yes;

# ============================================
# הגדרות Flask
# ============================================
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=True                    # שנה ל-False בפרודקשן!

# ============================================
# אבטחה - JWT
# ============================================
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=another-secret-key-for-jwt
JWT_EXPIRATION_HOURS=24

# ============================================
# CORS - כתובות מורשות
# ============================================
# בפיתוח: http://localhost:3000
# בפרודקשן: הוסף את כתובות ה-Production
CORS_ORIGINS=http://localhost:3000

# ============================================
# שליחת מיילים - SMTP
# ============================================
SMTP_SERVER=10.23.254.200
SMTP_PORT=25
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il

# ============================================
# כתובת Frontend (לקישורי איפוס סיסמה)
# ============================================
FRONTEND_URL=http://localhost:3000

# ============================================
# NVD API (לשליפת מידע על CVE)
# ============================================
# קבל מפתח חינמי מ: https://nvd.nist.gov/developers/request-an-api-key
NVD_API_KEY=your-nvd-api-key
```

#### שלב 4: הפעלת השרת
```bash
python main.py
```

#### שלב 5: בדיקת תקינות
- Server: `http://localhost:5000`
- Health Check: `http://localhost:5000/api/health`

---

## 📋 טבלת משתני סביבה מלאה

| משתנה | תיאור | ברירת מחדל | חובה? |
|-------|-------|-------------|-------|
| `SQL_CONNECTION_STRING` | מחרוזת חיבור ל-SQL Server | - | ✅ |
| `FLASK_HOST` | כתובת IP להאזנה | `0.0.0.0` | ❌ |
| `FLASK_PORT` | פורט השרת | `5000` | ❌ |
| `FLASK_DEBUG` | מצב Debug | `True` | ❌ |
| `SECRET_KEY` | מפתח סודי ל-Flask Session | - | ✅ |
| `JWT_SECRET_KEY` | מפתח סודי ל-JWT | ערך ברירת מחדל | ⚠️ שנה בפרודקשן |
| `JWT_EXPIRATION_HOURS` | תוקף JWT בשעות | `24` | ❌ |
| `CORS_ORIGINS` | כתובות CORS מורשות (מופרדות בפסיק) | `http://localhost:3000` | ❌ |
| `SMTP_SERVER` | כתובת שרת SMTP | `localhost` | ❌ |
| `SMTP_PORT` | פורט SMTP | `25` | ❌ |
| `SMTP_USERNAME` | שם משתמש SMTP | ריק | ❌ |
| `SMTP_PASSWORD` | סיסמת SMTP | ריק | ❌ |
| `SMTP_USE_TLS` | שימוש ב-TLS | `False` | ❌ |
| `SMTP_REQUIRE_AUTH` | דרישת אימות SMTP | `False` | ❌ |
| `FROM_EMAIL` | כתובת שולח המייל | `noreply@molsa.gov.il` | ❌ |
| `FROM_NAME` | שם שולח המייל | `מערכת Security Scans` | ❌ |
| `SCAN_REQUEST_EMAIL` | כתובת לקבלת בקשות סריקה | `AsafV@molsa.gov.il` | ❌ |
| `PT_REMINDER_FIXED_EMAIL` | נמען קבוע לתזכורות PT (45 יום לפני בדיקה) | `asafv@molsa.gov.il` | ❌ |
| `CYBER_RESEARCHER_EMAIL` | חוקר סייבר – נמען לתזכורות PT | ריק | ❌ |
| `FRONTEND_URL` | כתובת ה-Frontend | - | ⚠️ נדרש לאיפוס סיסמה |
| `NVD_API_KEY` | מפתח API ל-NVD | ריק | ⚠️ מומלץ |

---

## 🔧 תכונות

### אימות ואבטחה
- 🔐 **מערכת התחברות** - אימות משתמשים מול SQL Server
- 🎫 **JWT Tokens** - אימות בקשות עם JSON Web Tokens
- 🔑 **איפוס סיסמה** - טוקנים חד-פעמיים עם תוקף 24 שעות
- 💪 **סיסמאות חזקות:**
  - הצפנה עם Werkzeug (scrypt)
  - דרישות מחמירות (8 תווים, אותיות, ספרות, תווים מיוחדים)
  - וולידציה כפולה (שרת + קליינט)
- 📧 **מיילים מעוצבים** - תבניות Jinja2 חיצוניות עם RTL ועברית

### ניהול נתונים
- 📊 **מערכות** - CRUD מלא למערכות
- 🔍 **סריקות** - ניהול סריקות והיסטוריה
- 🚨 **חולשות** - ניתוח ומיון לפי חומרה
- 📈 **סטטיסטיקות** - דשבורד עם נתונים בזמן אמת
- 📁 **File Watcher** - עיבוד אוטומטי של קבצי CSV

### שליחת מיילים
- 📧 **איפוס סיסמה** - מייל מעוצב עם קוד איפוס
- 📨 **בקשת סריקה** - מייל מפורט לצוות האבטחה
- 🎨 **עיצוב HTML** - תבניות Jinja2 מקצועיות
- 🌐 **תמיכה בעברית** - RTL ופונטים עבריים

---

## 📁 מבנה הפרויקט

```
PT_Service_Backend/
├── src/
│   ├── api_server.py           # REST API endpoints
│   ├── database.py             # חיבור למסד נתונים ופונקציות
│   ├── jwt_auth.py             # אימות JWT tokens
│   ├── csv_parser.py           # עיבוד קבצי CSV
│   ├── file_watcher.py         # מעקב אוטומטי אחר קבצים
│   ├── email_service.py        # שירות שליחת מיילים
│   ├── nvd_api_client.py       # לקוח NVD API
│   └── password_validator.py   # וולידציה לסיסמאות
├── sql/
│   ├── init_tables.sql         # סקריפט יצירת טבלאות (DBA)
│   └── seed_admin_user.sql     # יצירת משתמש Admin (DBA)
├── templates/
│   └── email/                  # תבניות מייל Jinja2
│       ├── password_reset.html
│       ├── password_reset.txt
│       ├── scan_request.html
│       └── scan_request.txt
├── nikto_output/               # תיקייה לקבצי CSV
├── archive/                    # ארכיון קבצים מעובדים
├── main.py                     # נקודת כניסה ראשית
├── requirements.txt            # תלויות Python
├── .env                        # הגדרות סביבה (לא ב-Git!)
└── README.md                   # המסמך הזה
```

---

## 🔌 API Endpoints

### מערכות וסריקות
```
GET    /api/health                          # בדיקת תקינות
GET    /api/systems                         # כל המערכות
GET    /api/systems/:id                     # מערכת ספציפית
GET    /api/systems/:id/vulnerabilities     # חולשות של מערכת
GET    /api/scans                           # כל הסריקות
GET    /api/scans/:id/status                # סטטוס סריקה
POST   /api/scans/initiate                  # הפעלת סריקה
GET    /api/vulnerabilities                 # כל החולשות
GET    /api/vulnerabilities/recurring       # חולשות חוזרות
PUT    /api/vulnerabilities/:id/status      # עדכון סטטוס חולשה
GET    /api/stats                           # סטטיסטיקות
```

### אימות ואבטחה
```
POST   /api/auth/login                      # התחברות (מחזיר JWT)
POST   /api/auth/logout                     # התנתקות
POST   /api/auth/forgot-password            # בקשת איפוס סיסמה
POST   /api/auth/reset-password             # איפוס סיסמה עם טוקן
```

### ניהול משתמשים (Admin בלבד)
```
GET    /api/admin/users                     # כל המשתמשים
POST   /api/admin/users                     # יצירת משתמש
GET    /api/admin/users/:id                 # פרטי משתמש
PUT    /api/admin/users/:id                 # עדכון משתמש
DELETE /api/admin/users/:id                 # השבתת משתמש
POST   /api/admin/users/:id/activate        # הפעלת משתמש
POST   /api/admin/users/:id/reset-password  # איפוס סיסמה למשתמש
GET    /api/admin/user-types                # סוגי הרשאות
GET    /api/admin/users/:id/systems         # מערכות של משתמש
PUT    /api/admin/users/:id/systems         # עדכון מערכות של משתמש
GET    /api/admin/systems                   # כל המערכות לבחירה
POST   /api/admin/pt-tracking/send-reminders # שליחת תזכורות PT (45 יום לפני בדיקה) – להפעיל פעם ביום
```

### בקשות
```
POST   /api/scan-request                    # שליחת בקשה לסריקה
```

### משימות מתוזמנות (Cron)

כדי שתזכורות **מעקב PT ידני** (45 יום לפני תאריך בדיקה הבא) יישלחו אוטומטית, יש להפעיל את ה-endpoint הבא **פעם ביום**:

- **Endpoint:** `POST /api/admin/pt-tracking/send-reminders`
- **הרשאה:** נדרש JWT של משתמש Admin (לשלוח ב-header: `Authorization: Bearer <token>` או `X-Access-Token: <token>`).

**דוגמאות:**

- **Linux (cron):** הוסף שורה ל-`crontab -e`, למשל הרצה כל יום ב-08:00:
  ```bash
  0 8 * * * curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://your-backend/api/admin/pt-tracking/send-reminders
  ```
  (במקום token קבוע אפשר להשתמש בסקריפט שמתחבר, מקבל token, ואז קורא ל-endpoint.)

- **Windows (Task Scheduler):** צור משימה יומית שמפעילה `curl` או PowerShell לקריאה ל-URL הנ"ל עם header האימות.

---

## 🔐 אימות JWT

### שימוש ב-JWT Token

לאחר התחברות מוצלחת, ה-API מחזיר JWT token:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "username": "admin",
    "user_type_id": 1
  }
}
```

### שליחת Token בבקשות

יש לשלוח את ה-token בכל בקשה מוגנת:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

או:

```http
X-Access-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ מבנה מסד נתונים

### טבלאות עיקריות:
- **UsersType** - סוגי משתמשים (Admin, System Manager, Super Manager)
- **Users** - משתמשי המערכת
- **PasswordResets** - טוקני איפוס סיסמה
- **Systems** - מערכות לסריקה
- **SystemsUsers** - קישור משתמשים-מערכות
- **Scans** - סריקות שבוצעו
- **Vulnerabilities** - חולשות שנמצאו

### קשרים:
```
UsersType ──> Users ──> PasswordResets
                   └──> SystemsUsers ──> Systems ──> Scans ──> Vulnerabilities
```

---

## 📧 הגדרת שליחת מיילים

### אפשרות 1: שרת SMTP פנימי (מומלץ)
```env
SMTP_SERVER=10.23.254.200
SMTP_PORT=25
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
```

### אפשרות 2: Office 365
```env
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@molsa.gov.il
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=True
SMTP_REQUIRE_AUTH=True
```

### בדיקת חיבור
```bash
python -c "from src.email_service import email_service; email_service.test_connection()"
```

---

## 🔒 אבטחה

### הגנות מובנות:
- ✅ **JWT Authentication** - אימות מאובטח לכל בקשה
- ✅ **Password Hashing** - Werkzeug scrypt
- ✅ **SQL Injection Prevention** - Parameterized queries
- ✅ **CORS** - הגדרות מאובטחות לפי סביבה
- ✅ **Token-based Reset** - טוקנים חד-פעמיים
- ✅ **Input Validation** - וולידציה של כל קלט משתמש

### המלצות לפרודקשן:
1. שנה `FLASK_DEBUG=False`
2. השתמש ב-HTTPS
3. הגדר `JWT_SECRET_KEY` ייחודי וחזק
4. הגדר `CORS_ORIGINS` רק לכתובות הפרודקשן
5. הגדר WSGI server (Gunicorn/uWSGI)
6. הוסף rate limiting
7. הגדר logging לקובץ
8. גיבוי מסד נתונים קבוע

---

## 🐛 פתרון בעיות

### שגיאת חיבור למסד נתונים
```bash
# בדוק את פרטי החיבור ב-.env
# ודא ש-SQL Server פועל
# בדוק את ODBC Driver
```

### שגיאה בשליחת מייל
```bash
# בדוק הגדרות SMTP ב-.env
python -c "from src.email_service import email_service; email_service.test_connection()"
```

### Token פג תוקף
```
# ה-token תקף ל-24 שעות (ניתן לשנות עם JWT_EXPIRATION_HOURS)
# יש להתחבר מחדש לקבלת token חדש
```

### NVD API לא עובד
```bash
# בדוק שהגדרת NVD_API_KEY ב-.env
# קבל מפתח חינמי מ: https://nvd.nist.gov/developers/request-an-api-key
```

---

## 📦 Dependencies

### עיקריות:
- **Flask** - Web framework
- **Flask-CORS** - Cross-origin requests
- **PyJWT** - JWT token handling
- **pyodbc** - SQL Server connection
- **werkzeug** - Password hashing
- **python-dotenv** - Environment variables
- **Jinja2** - Template engine
- **pandas** - CSV processing
- **watchdog** - File monitoring
- **requests** - HTTP client

### מלא:
ראה `requirements.txt`

---

## 🌟 גרסאות

### גרסה 2.1 (ינואר 2026)
- ✅ מנגנון JWT לאימות בקשות
- ✅ תבניות מייל Jinja2 חיצוניות
- ✅ תיקוני SQL Injection
- ✅ סקריפטי SQL נפרדים ליצירת טבלאות
- ✅ שיפורי CORS לאבטחה
- ✅ תיעוד מקיף

### גרסה 2.0 (אוקטובר 2025)
- ✅ מערכת התחברות מלאה
- ✅ איפוס סיסמה עם מיילים
- ✅ דרישות סיסמה חזקה
- ✅ שליחת מיילים מעוצבים
- ✅ וולידציה משופרת
- ✅ בקשת סריקה במייל

### גרסה 1.0
- מערכת בסיסית לניהול סריקות

---

**PT Services Backend** - שרת Flask מתקדם לניהול אבטחת מידע 🔐

**גרסה:** 2.1 | **עודכן:** ינואר 2026 | **תחזוקה:** פעילה
