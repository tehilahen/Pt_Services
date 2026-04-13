# ✅ רשימת בדיקה לפריסה - Security Scans System

## 📋 לפני הפריסה

### הכנת סביבה

- [ ] Python 3.8+ מותקן
- [ ] SQL Server זמין ופועל
- [ ] ODBC Driver 17 for SQL Server מותקן
- [ ] Node.js מותקן (לפרונטאנד)
- [ ] גישה לשרת SMTP
- [ ] גישת רשת לשרת (פורטים 5000, 3000)

### הגדרת Backend

- [ ] קובץ `.env` נוצר ומוגדר נכון:
  - [ ] פרטי חיבור למסד נתונים
  - [ ] הגדרות שרת Flask
  - [ ] הגדרות SMTP
  - [ ] כתובת מייל לבקשות סריקה
  
- [ ] תלויות Python מותקנות:
  ```bash
  pip install -r requirements.txt
  ```

- [ ] חיבור למסד נתונים עובד:
  ```bash
  python check_users_simple.py
  ```

### הגדרת Frontend

- [ ] תלויות Node מותקנות:
  ```bash
  npm install
  ```

- [ ] ה-proxy מוגדר נכון ב-`setupProxy.js`

### הגדרת מיילים

- [ ] שרת SMTP נבדק:
  ```bash
  python -c "from src.email_service import email_service; email_service.test_connection()"
  ```

- [ ] בדיקת שליחת מייל:
  - [ ] מייל איפוס סיסמה
  - [ ] מייל בקשת סריקה

- [ ] **תזכורות מעקב PT ידני:** מוגדר תזמון (Cron / Task Scheduler) להרצת `POST /api/admin/pt-tracking/send-reminders` פעם ביום (נדרש token של Admin). ראה README – סעיף "משימות מתוזמנות (Cron)".

---

## 🚀 בדיקות לפני הפעלה

### בדיקות Backend

- [ ] השרת עולה ללא שגיאות:
  ```bash
  python main.py
  ```

- [ ] API Health מגיב:
  ```bash
  http://localhost:5000/api/health
  ```

- [ ] כל ה-endpoints עובדים:
  - [ ] `/api/systems`
  - [ ] `/api/scans`
  - [ ] `/api/vulnerabilities`
  - [ ] `/api/stats`
  - [ ] `/api/auth/login`

### בדיקות Frontend

- [ ] הממשק עולה:
  ```bash
  npm start
  ```

- [ ] מסך התחברות מוצג
- [ ] חיבור לBackend עובד
- [ ] כל העמודים נטענים

### בדיקות אינטגרציה

- [ ] התחברות עובדת
- [ ] איפוס סיסמה עובד מקצה לקצה:
  - [ ] בקשת איפוס
  - [ ] קבלת מייל
  - [ ] הזנת טוקן
  - [ ] שינוי סיסמה
  - [ ] התחברות עם סיסמה חדשה

- [ ] בקשת סריקה עובדת:
  - [ ] מילוי טופס
  - [ ] שליחת בקשה
  - [ ] קבלת מייל

### בדיקות אבטחה

- [ ] סיסמאות מוצפנות במסד הנתונים
- [ ] טוקנים חד-פעמיים
- [ ] וולידציה פועלת (קליינט + שרת)
- [ ] CORS מוגדר נכון
- [ ] אין חשיפת מידע רגיש בלוגים

---

## 🔐 אבטחה בפרודקשן

### הגדרות חובה

- [ ] שנה `FLASK_DEBUG=False`
- [ ] הגדר HTTPS
- [ ] החלף סיסמאות ברירת מחדל
- [ ] הגדר firewall rules
- [ ] הפעל WSGI server (Gunicorn/uWSGI)

### הגדרות מומלצות

- [ ] הוסף rate limiting
- [ ] הגדר session timeout
- [ ] הפעל logging לקובץ
- [ ] הגדר backup אוטומטי
- [ ] הגדר monitoring (CPU, Memory, Disk)

### אבטחת מסד נתונים

- [ ] גיבוי יומי
- [ ] הרשאות מוגבלות למשתמש שירות
- [ ] חיבור מוצפן (אם אפשרי)
- [ ] ניקוי טוקנים ישנים אוטומטי

---

## 📊 ניטור ותחזוקה

### יומי

- [ ] בדיקת לוגים לשגיאות
- [ ] בדיקת שליחת מיילים
- [ ] בדיקת שימוש בדיסק

### שבועי

- [ ] בדיקת ביצועים
- [ ] ניקוי לוגים ישנים
- [ ] בדיקת חיבורים פתוחים

### חודשי

- [ ] עדכון תלויות
- [ ] בדיקת אבטחה
- [ ] גיבוי מלא
- [ ] בדיקת קיבולת

---

## 🆘 תיקון בעיות

### אם המערכת לא עולה

```bash
# 1. בדוק תהליכי Python
tasklist | findstr python

# 2. עצור תהליכים ישנים
taskkill /F /IM python.exe

# 3. נקה __pycache__
rmdir /s /q src\__pycache__

# 4. הפעל מחדש
python main.py
```

### אם המיילים לא נשלחים

```bash
# 1. בדוק הגדרות
python -c "from src.email_service import email_service; print(email_service.smtp_server, email_service.smtp_port)"

# 2. בדוק חיבור
python -c "from src.email_service import email_service; email_service.test_connection()"

# 3. בדוק לוגים
# הסתכל בטרמינל לשגיאות SMTP
```

### אם ההתחברות לא עובדת

```bash
# איפוס סיסמה ידני
python get_reset_token.py
# או פנה למנהל מערכת
```

---

## 📞 אנשי קשר

### תמיכה טכנית
- **אימייל:** AsafV@molsa.gov.il
- **מחלקת IT:** לפי הנוהל הארגוני

### מפתחים
- Backend: Python Flask
- Frontend: React
- Database: SQL Server

---

## 📝 הערות נוספות

### קבצים שלא לשתף
- `.env` - מכיל סיסמאות ופרטים רגישים
- `*.pyc` - קבצים זמניים
- `__pycache__/` - תיקיות זמניות
- לוגים עם מידע רגיש

### גיבוי מומלץ
- מסד נתונים: יומי
- קבצי קוד: Git
- קבצי הגדרה: שבועי
- ארכיון CSV: חודשי

---

**מסמך זה:** עדכן אחרי כל שינוי משמעותי

**גרסה נוכחית:** 2.0

**תאריך עדכון אחרון:** נובמבר 2024

