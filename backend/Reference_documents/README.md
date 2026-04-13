# 🛡️ PT Services Backend - מערכת Security Scans

שרת Backend ב-Python Flask לניהול סריקות אבטחה, חולשות ומשתמשים.

## 🚀 הפעלה מהירה

### דרישות מערכת
- Python 3.8+
- SQL Server (SQLDEV)
- ODBC Driver 17 for SQL Server
- שרת SMTP (לשליחת מיילים)

### התקנה והפעלה

1. **התקנת תלויות:**
   ```bash
   pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --proxy=http://192.168.174.80:8080
 -r requirements.txt
   ```

2. **הגדרת משתני סביבה:**
   
   צור קובץ `.env` (או ערוך את הקיים):
   ```env
   # חיבור למסד נתונים - SQL Server Authentication (שם משתמש וסיסמה)
   SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=SQLDEV;Database=SA_DTI_Security_NiktoWebServerScanner;UID=ptuser;PWD=YOUR_PASSWORD;TrustServerCertificate=yes;
   
   # שרת Flask
   FLASK_HOST=0.0.0.0
   FLASK_PORT=5000
   FLASK_DEBUG=True
   
   # שליחת מיילים
   SMTP_SERVER=10.23.254.200
   SMTP_PORT=25
   SMTP_USERNAME=
   SMTP_PASSWORD=
   SMTP_USE_TLS=False
   SMTP_REQUIRE_AUTH=False
   FROM_EMAIL=noreply@molsa.gov.il
   FROM_NAME=מערכת Security Scans
   SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
   ```

3. **הפעלת השרת:**
   ```bash
   python main.py
   ```

4. **גישה ל-API:**
   - Server: `http://localhost:5000`
   - Health Check: `http://localhost:5000/api/health`

## 🔧 תכונות

### אימות ואבטחה
- 🔐 **מערכת התחברות** - אימות משתמשים מול SQL Server
- 🔑 **איפוס סיסמה** - טוקנים חד-פעמיים עם תוקף 24 שעות
- 💪 **סיסמאות חזקות:**
  - הצפנה עם Werkzeug (scrypt)
  - דרישות מחמירות (8 תווים, אותיות, ספרות, תווים מיוחדים)
  - וולידציה כפולה (שרת + קליינט)
- 📧 **מיילים מעוצבים** - HTML templates עם RTL ועברית

### ניהול נתונים
- 📊 **מערכות** - CRUD מלא למערכות
- 🔍 **סריקות** - ניהול סריקות והיסטוריה
- 🚨 **חולשות** - ניתוח ומיון לפי חומרה
- 📈 **סטטיסטיקות** - דשבורד עם נתונים בזמן אמת
- 📁 **File Watcher** - עיבוד אוטומטי של קבצי CSV

### שליחת מיילים
- 📧 **איפוס סיסמה** - מייל מעוצב עם קוד איפוס
- 📨 **בקשת סריקה** - מייל מפורט לצוות האבטחה
- 🎨 **עיצוב HTML** - תבניות מקצועיות עם gradients
- 🌐 **תמיכה בעברית** - RTL ופונטים עבריים

## 📁 מבנה הפרויקט

```
PT_Service_Backend/
├── src/
│   ├── api_server.py           # REST API endpoints
│   ├── database.py             # חיבור למסד נתונים ופונקציות
│   ├── csv_parser.py           # עיבוד קבצי CSV
│   ├── file_watcher.py         # מעקב אוטומטי אחר קבצים
│   ├── email_service.py        # שירות שליחת מיילים
│   └── password_validator.py  # וולידציה לסיסמאות
├── nikto output/               # תיקייה לקבצי CSV
├── archive/                    # ארכיון קבצים מעובדים
├── main.py                     # נקודת כניסה ראשית
├── requirements.txt            # תלויות Python
├── .env                        # הגדרות סביבה (לא בגרסיה)
├── get_reset_token.py          # כלי עזר לקבלת טוקן
└── README.md                   # המסמך הזה
```

## 🔌 API Endpoints

### מערכות וסריקות
```
GET    /api/health                          # בדיקת תקינות
GET    /api/systems                         # כל המערכות
GET    /api/systems/:id                     # מערכת ספציפית
GET    /api/systems/:id/vulnerabilities     # חולשות של מערכת
GET    /api/scans                           # כל הסריקות
GET    /api/scans/:id/vulnerabilities       # חולשות של סריקה
GET    /api/vulnerabilities                 # כל החולשות
GET    /api/stats                           # סטטיסטיקות
```

### אימות ואבטחה
```
POST   /api/auth/login                      # התחברות
POST   /api/auth/logout                     # התנתקות
POST   /api/auth/forgot-password            # בקשת איפוס סיסמה
POST   /api/auth/reset-password             # איפוס סיסמה עם טוקן
```

### בקשות
```
POST   /api/scan-request                    # שליחת בקשה לסריקה
POST   /api/process-csv-file                # עיבוד קובץ CSV
```

## 🗄️ מבנה מסד נתונים

### טבלאות עיקריות:
- **Users** - משתמשי המערכת
- **Systems** - מערכות לסריקה
- **Scans** - סריקות שבוצעו
- **Vulnerabilities** - חולשות שנמצאו
- **PasswordResets** - טוקני איפוס סיסמה

### קשרים:
```
Users ──┐
        ├──> Systems ──> Scans ──> Vulnerabilities
        └──> PasswordResets
```

## 📧 הגדרת שליחת מיילים

### אפשרות 1: שרת SMTP פנימי (מומלץ)

הוסף ל-`.env`:
```env
SMTP_SERVER=10.23.254.200
SMTP_PORT=25
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
```

### אפשרות 2: Office 365

```env
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@molsa.gov.il
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=True
SMTP_REQUIRE_AUTH=True
FROM_EMAIL=your-email@molsa.gov.il
FROM_NAME=מערכת Security Scans
```

### בדיקת חיבור

```bash
python -c "from src.email_service import email_service; email_service.test_connection()"
```

📖 **מידע מפורט:** קרא את `EMAIL_CONFIG.md`

## 🛠️ כלים עזרים


## 🔐 אבטחה

### הגנת סיסמאות
- ✅ הצפנה עם **Werkzeug** (scrypt algorithm)
- ✅ Salt אוטומטי לכל סיסמה
- ✅ אין אחסון סיסמאות בטקסט פשוט
- ✅ דרישות מחמירות לסיסמאות חדשות

### טוקני איפוס
- ✅ טוקנים אקראיים (32 תווים)
- ✅ תוקף מוגבל (24 שעות)
- ✅ חד-פעמיים (לא ניתן לשימוש חוזר)
- ✅ ניקוי אוטומטי של טוקנים שפג תוקפם

### תקשורת
- ✅ CORS מוגדר נכון
- ✅ HTTPS מומלץ לפרודקשן
- ✅ Secure headers

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
# נסה: python -c "from src.email_service import email_service; email_service.test_connection()"
# בדוק לוגים לשגיאות מפורטות
```

### לא מצליח להתחבר
```bash
# איפוס סיסמה:
python -c "from src.database import db_connection; from werkzeug.security import generate_password_hash; db_connection.execute_non_query('UPDATE Users SET Password = ? WHERE UserName = ?', (generate_password_hash('Test123!'), 'tehilaco'))"
```

## 📊 לוגים

הלוגים מוצגים בזמן אמת ב-Terminal:
- **INFO** - פעולות רגילות
- **WARNING** - אזהרות (כמו ניסיונות התחברות כושלים)
- **ERROR** - שגיאות

דוגמה:
```
INFO:src.api_server:ניסיון התחברות עבור משתמש: tehilaco
INFO:src.database:משתמש התחבר בהצלחה: tehilaco
INFO:src.email_service:✓ מייל נשלח בהצלחה ל-tehilaco@molsa.gov.il
```

## 📝 סיסמאות ברירת מחדל

**משתמש ברירת מחדל:**
- Username: `tehilaco`
- Email: `tehilaco@molsa.gov.il`
- Password: השתמש באיפוס סיסמה אם שכחת

> ⚠️ **חשוב:** שנה את הסיסמאות ברירת המחדל בפרודקשן!

## 🔄 תהליך עבודה

### עיבוד קבצי CSV
1. העתק קובץ CSV לתיקייה `nikto output/`
2. המערכת מזהה ומעבדת אוטומטית
3. הנתונים מתווספים למסד הנתונים
4. הקובץ מועבר ל-`archive/`

### איפוס סיסמה
1. משתמש מבקש איפוס דרך הממשק
2. השרת יוצר טוקן ושומר במסד נתונים
3. מייל מעוצב נשלח עם הטוקן
4. המשתמש מזין טוקן + סיסמה חדשה
5. הסיסמה מתעדכנת והטוקן מסומן כמנוצל

### בקשת סריקה
1. משתמש ממלא טופס בקשה
2. השרת שולח מייל מעוצב לצוות האבטחה
3. המייל כולל כל הפרטים הרלוונטיים
4. ניתן להגיב ישירות למייל (Reply-To)

## 📚 מסמכי עזר

- **📚_START_HERE.md** - נקודת כניסה ומדריך ניווט
- **CHANGELOG.md** - כל השינויים, התיקונים והשיפורים
- **USER_GUIDE.md** - מדריך למשתמש קצה
- **EMAIL_CONFIG.md** - מדריך מקיף להגדרת מיילים ו-SMTP
- **QUICK_START.md** - התחלה מהירה ב-3 צעדים
- **DEPLOYMENT_CHECKLIST.md** - רשימת בדיקה לפריסה

## 🔒 אבטחה

### הגנות מובנות:
- ✅ **Password Hashing** - Werkzeug scrypt
- ✅ **SQL Injection** - Parameterized queries
- ✅ **CORS** - הגדרות מאובטחות
- ✅ **Token-based Reset** - טוקנים חד-פעמיים
- ✅ **Input Validation** - וולידציה של כל קלט משתמש
- ✅ **Rate Limiting** - מומלץ להוסיף בפרודקשן

### המלצות לפרודקשן:
1. שנה `FLASK_DEBUG=False`
2. השתמש ב-HTTPS
3. הגדר WSGI server (Gunicorn/uWSGI)
4. הוסף rate limiting
5. הגדר logging לקובץ
6. גיבוי מסד נתונים קבוע

## 🧪 בדיקות

### בדיקת שליחת מיילים:
```bash
python -c "from src.email_service import email_service; email_service.test_connection()"
```

### קבלת טוקן איפוס:
```bash
python get_reset_token.py
# הזן אימייל משתמש
```

## 📊 API Documentation

### Authentication

**POST /api/auth/login**
```json
Request:
{
  "username": "tehilaco",
  "password": "Test123!"
}

Response:
{
  "success": true,
  "user": {
    "user_id": 1,
    "username": "tehilaco",
    "email": "tehilaco@molsa.gov.il",
    "user_type_id": 1
  }
}
```

**POST /api/auth/forgot-password**
```json
Request:
{
  "email": "tehilaco@molsa.gov.il"
}

Response:
{
  "success": true,
  "message": "קוד איפוס נשלח לכתובת האימייל שלך"
}
```

**POST /api/auth/reset-password**
```json
Request:
{
  "token": "ABC123XYZ...",
  "newPassword": "NewPass123!"
}

Response:
{
  "success": true,
  "message": "הסיסמא שונתה בהצלחה"
}
```

**POST /api/scan-request**
```json
Request:
{
  "requesterName": "תהילה כהן",
  "requesterEmail": "tehilaco@molsa.gov.il",
  "requesterPhone": "050-1234567",
  "systemName": "מערכת חדשה",
  "systemUrl": "https://example.com",
  "details": "פרטים נוספים..."
}

Response:
{
  "success": true,
  "message": "הבקשה נשלחה בהצלחה!"
}
```

## 🔄 Git Workflow

```bash
# בדיקת סטטוס
git status

# הוספת שינויים
git add .

# Commit
git commit -m "תיאור השינויים"

# Push
git push origin LOGIN
```

## 📦 Dependencies

### עיקריות:
- **Flask** - Web framework
- **Flask-CORS** - Cross-origin requests
- **pyodbc** - SQL Server connection
- **werkzeug** - Password hashing
- **python-dotenv** - Environment variables
- **pandas** - CSV processing
- **watchdog** - File monitoring

### מלא:
ראה `requirements.txt`

## 🤝 תמיכה

### בעיות נפוצות:

**1. ImportError: cannot import name 'db_connection'**
- ודא שכל הקבצים ב-`src/` במקום
- הרץ מהתיקייה הראשית

**2. pyodbc.Error: Data source name not found**
- התקן ODBC Driver 17 for SQL Server
- בדוק את `SQL_SERVER` ב-.env

**3. SMTP Authentication Error**
- שנה `SMTP_REQUIRE_AUTH=False` אם השרת לא דורש אימות
- בדוק username/password אם דורש אימות

**4. הסיסמה לא משתנה**
- בדוק לוגים לשגיאות
- ודא שהטוקן תקף (לא פג תוקף, לא נוצל)
- הרץ `check_users.py` לבדיקה

### קבלת עזרה:
1. בדוק את הלוגים בטרמינל
2. קרא את `SUMMARY.md`
3. הרץ סקריפטי בדיקה
4. פנה לצוות הפיתוח

## 📈 מעקב ביצועים

המערכת כוללת logging מפורט:
- חיבורי משתמשים
- שליחת מיילים
- עדכוני מסד נתונים
- עיבוד קבצים



