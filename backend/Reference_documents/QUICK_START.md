# ⚡ התחלה מהירה - מערכת Security Scans

## 📝 מה צריך כדי להתחיל?

- [x] Python 3.8+
- [x] SQL Server מותקן ופועל
- [x] Node.js (לפרונטאנד)
- [x] גישה לשרת SMTP (לשליחת מיילים)

---

## 🚀 הפעלה ב-3 צעדים

### 📁 שלב 1: Backend

```bash
# עבור לתיקייה
cd C:\Users\tehilaco\projects\PT_Service_Backend

# התקן תלויות (פעם אחת)
pip install -r requirements.txt

# הפעל את השרת
python main.py
```

✅ השרת אמור לרוץ על: `http://localhost:5000`

---

### 🎨 שלב 2: Frontend

**פתח Terminal/PowerShell חדש:**

```bash
# עבור לתיקייה
cd C:\Users\tehilaco\projects\PT_Service_fronend

# התקן תלויות (פעם אחת)
npm install

# הפעל את הממשק
npm start
```

✅ הדפדפן ייפתח אוטומטית ל: `http://localhost:3000`

---

### 🔐 שלב 3: התחבר

1. תראה מסך התחברות
2. הזן:
   - **שם משתמש:** `tehilaco`
   - **סיסמה:** `1234` (או הסיסמה שלך)
3. לחץ "התחבר"

**זהו! אתה בפנים!** 🎉

---

## 🔧 הגדרה ראשונית

### אם זו ההרצה הראשונה:

1. **צור קובץ .env** בתיקיית Backend:
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

2. **שמור את הקובץ**

3. **הפעל מחדש את השרת**

---

## ✅ בדיקה שהכל עובד

### בדיקת Backend:
```bash
# פתח בדפדפן:
http://localhost:5000/api/health

# אמור להחזיר:
{
  "status": "healthy",
  "database": "connected"
}
```

### בדיקת Frontend:
```bash
# פתח בדפדפן:
http://localhost:3000

# אמור לראות:
- מסך התחברות מעוצב
```

---

## 🎯 פעולות נפוצות

### איפוס סיסמה

```
1. שכחתי סיסמא
2. הזן מייל → קבל קוד
3. הזן קוד + סיסמה חדשה
4. התחבר עם הסיסמה החדשה
```

**זכור:** הסיסמה חייבת לכלול:
- 8+ תווים
- אות גדולה + קטנה
- ספרה
- תו מיוחד

### בקשת סריקה

```
1. היכנס למערכת
2. לחץ "בקשת סריקה"
3. מלא פרטים
4. שלח
```

הבקשה נשלחת אוטומטית למייל!

---

## 🆘 משהו לא עובד?

### Backend לא עולה?

```bash
# בדוק שגיאות:
cd C:\Users\tehilaco\projects\PT_Service_Backend
python main.py
# קרא את השגיאות שמוצגות
```

שגיאות נפוצות:
- **"cannot import name"** → הרץ `pip install -r requirements.txt`
- **"connection failed"** → בדוק ש-SQL Server פועל
- **"port in use"** → עצור תהליכי Python אחרים: `taskkill /F /IM python.exe`

### Frontend לא עולה?

```bash
# בדוק שגיאות:
cd C:\Users\tehilaco\projects\PT_Service_fronend
npm start
```

שגיאות נפוצות:
- **"Module not found"** → הרץ `npm install`
- **"Port 3000 in use"** → הרץ `PORT=3001 npm start`

### לא מצליח להתחבר?

1. **נסה איפוס סיסמה**
2. **פנה למנהל מערכת**
3. **בדוק את הלוגים** בטרמינל של Backend

---

## 📖 מסמכים נוספים

- **README.md** - תיעוד מלא של המערכת
- **CHANGELOG.md** - כל השינויים והגרסאות
- **USER_GUIDE.md** - מדריך למשתמש קצה
- **EMAIL_CONFIG.md** - הגדרת מיילים ו-SMTP

---

## 🎓 למדתי! מה הלאה?

אחרי שהכל עובד:

1. 🔍 **חקור את המערכות** - צפה בכל המערכות והחולשות
2. 📊 **צפה בדשבורד** - ראה סטטיסטיקות
3. 🔐 **שנה סיסמה** - הגדר סיסמה חזקה חדשה
4. 📧 **בקש סריקה** - שלח בקשה למערכת חדשה

**תהנה מהמערכת!** 🎉

---

**זמן הפעלה משוער:** 5-10 דקות (אם הכל מוגדר)

**נוצר:** נובמבר 2024
**גרסה:** 2.0

