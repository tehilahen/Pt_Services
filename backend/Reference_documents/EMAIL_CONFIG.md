# 📧 מדריך מקיף להגדרת שליחת מיילים

## 🎯 מטרת המסמך

מדריך זה מסביר כיצד להגדיר שליחת מיילים במערכת Security Scans.
המערכת צריכה לשלוח מיילים **לכל כתובת שמוזנת על ידי המשתמש**, ולכן אנחנו משתמשים בשרת SMTP של הארגון.

---

## 📋 אפשרויות הגדרה

### ✅ אפשרות 1: שרת SMTP פנימי (מומלץ למשרדי ממשלה)

רוב המשרדים הממשלתיים יש להם שרת מייל פנימי שמאפשר שליחת מיילים ללא אימות מכתובות IP מאושרות.

**שמות שרת נפוצים:**
- `mail.molsa.gov.il`
- `smtp.molsa.gov.il`
- `exchange.molsa.gov.il`
- `mailrelay.molsa.gov.il`

**הגדרות ב-.env:**
```env
SMTP_SERVER=mail.molsa.gov.il
SMTP_PORT=25
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
```

**יתרונות:**
- ✅ לא צריך סיסמה
- ✅ שולח לכל כתובת
- ✅ פשוט להגדיר
- ✅ עובד מכל מכונה ברשת הפנימית

---

### 🔐 אפשרות 2: SMTP Relay עם אימות

חלק מהארגונים דורשים אימות בסיסי אבל מאפשרים שליחה לכל כתובת.

**הגדרות ב-.env:**
```env
SMTP_SERVER=mailrelay.molsa.gov.il
SMTP_PORT=587
SMTP_USERNAME=security-scans-service
SMTP_PASSWORD=service-password
SMTP_USE_TLS=True
SMTP_REQUIRE_AUTH=True
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
```

**יתרונות:**
- ✅ מאובטח יותר
- ✅ שולח לכל כתובת
- ⚠️ צריך לקבל חשבון שירות מהמחלקה הטכנית

---

### 🌐 אפשרות 3: Office 365 (אם אין ברירה)

אם אין שרת פנימי, אפשר להשתמש ב-Office 365, אבל זה דורש חשבון ייעודי.

**הגדרות ב-.env:**
```env
SMTP_SERVER=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=security-scans@molsa.gov.il
SMTP_PASSWORD=app-password-here
SMTP_USE_TLS=True
SMTP_REQUIRE_AUTH=True
FROM_EMAIL=security-scans@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
```

#### יצירת App Password ב-Office 365:

1. היכנס ל-[Microsoft Account Security](https://account.microsoft.com/security)
2. עבור ל-"Security info" → "Add sign-in method"
3. בחר "App password"
4. צור סיסמת אפליקציה חדשה
5. השתמש בסיסמה זו ב-`SMTP_PASSWORD`

**חסרונות:**
- ⚠️ צריך חשבון ייעודי
- ⚠️ צריך App Password
- ⚠️ יותר מסובך

---

## 🔍 איך למצוא את שרת ה-SMTP שלכם?

### שיטה 1: שאל את מחלקת התשתיות/IT (מומלץ)

שאל את השאלות הבאות:
1. מה כתובת שרת ה-SMTP/Mail Relay הפנימי?
2. איזה פורט להשתמש? (25, 587, או 465)
3. האם צריך אימות?
4. האם אפשר לשלוח מ-noreply@molsa.gov.il?

### שיטה 2: בדוק הגדרות Outlook

1. פתח **Outlook**
2. **File** → **Account Settings** → **Account Settings**
3. בחר את החשבון → **Change**
4. לחץ **More Settings** → **Advanced**
5. שים לב לשדה **Server** ו-**Port**

### שיטה 3: בדוק DNS Records

```bash
nslookup -type=MX molsa.gov.il
```

זה יחזיר את שרתי המייל של הדומיין.

---

## 🚀 הגדרה צעד אחר צעד

### שלב 1: צור/ערוך קובץ .env

בתיקיית הבסיס של Backend, צור או ערוך את הקובץ `.env`:

```env
# חיבור למסד נתונים - SQL Server Authentication (שם משתמש וסיסמה)
SQL_CONNECTION_STRING=Driver={ODBC Driver 17 for SQL Server};Server=SQLDEV;Database=SA_DTI_Security_NiktoWebServerScanner;UID=ptuser;PWD=YOUR_PASSWORD;TrustServerCertificate=yes;

# שרת Flask
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=True

# שליחת מיילים - נסה תחילה הגדרות בסיסיות
SMTP_SERVER=localhost
SMTP_PORT=25
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_TLS=False
SMTP_REQUIRE_AUTH=False
FROM_EMAIL=noreply@molsa.gov.il
FROM_NAME=מערכת Security Scans
SCAN_REQUEST_EMAIL=AsafV@molsa.gov.il
```

### שלב 2: בדוק חיבור

```bash
cd C:\Users\tehilaco\projects\PT_Service_Backend
python -c "from src.email_service import email_service; email_service.test_connection()"
```

**תוצאה מצופה:**
```
✓ חיבור לשרת SMTP הצליח
✓ אימות הצליח (אם נדרש)
```

### שלב 3: אם לא עובד, נסה שמות אחרים

נסה את ההגדרות הבאות בזו אחר זו:

```env
SMTP_SERVER=mail.molsa.gov.il
```

או:

```env
SMTP_SERVER=smtp.molsa.gov.il
```

או:

```env
SMTP_SERVER=mailrelay.molsa.gov.il
```

### שלב 4: הפעל את השרת

```bash
python main.py
```

---

## 🧪 בדיקות

### בדיקה 1: חיבור בסיסי

```bash
python -c "from src.email_service import email_service; email_service.test_connection()"
```

### בדיקה 2: שליחת מייל איפוס סיסמה

1. פתח את הממשק: `http://localhost:3000`
2. לחץ "שכחתי סיסמא"
3. הזן אימייל קיים
4. בדוק שהמייל הגיע

### בדיקה 3: שליחת בקשת סריקה

1. היכנס למערכת
2. לחץ "בקשת סריקה"
3. מלא את הטופס
4. בדוק שהמייל הגיע ל-AsafV@molsa.gov.il

---

## 🐛 פתרון בעיות

### שגיאת חיבור (Connection Error)

**תסמינים:**
```
ERROR: Could not connect to SMTP server
```

**פתרונות:**
1. בדוק ש-`SMTP_SERVER` נכון
2. בדוק ש-`SMTP_PORT` פתוח (נסה 25, 587, 465)
3. בדוק Firewall - וודא שאין חסימה
4. נסה `SMTP_SERVER=localhost` אם אתה על השרת עצמו

### שגיאת אימות (Authentication Error)

**תסמינים:**
```
ERROR: Authentication failed
```

**פתרונות:**
1. אם לא צריך אימות: `SMTP_REQUIRE_AUTH=False`
2. אם צריך: בדוק `SMTP_USERNAME` ו-`SMTP_PASSWORD`
3. נסה App Password במקום סיסמה רגילה
4. בדוק ש-`SMTP_USE_TLS=True` אם משתמש בפורט 587

### המייל לא מגיע

**פתרונות:**
1. בדוק תיקיית **Spam/Junk**
2. ודא שכתובת האימייל נכונה במסד הנתונים
3. בדוק את הלוגים בטרמינל של Backend
4. נסה לשלוח מייל לכתובת אחרת

### TLS/SSL Errors

**תסמינים:**
```
ERROR: SSL: CERTIFICATE_VERIFY_FAILED
```

**פתרונות:**
1. נסה `SMTP_USE_TLS=False` לשרתים פנימיים
2. אם צריך TLS, ודא שהפורט 587 (לא 25)
3. עבור Office 365, תמיד השתמש ב-`SMTP_USE_TLS=True`

---

## ❓ שאלות נפוצות

### Q: המערכת חייבת לשלוח דווקא מ-noreply@molsa.gov.il?
**A:** לא. אפשר לשנות ל-`FROM_EMAIL=security-scans@molsa.gov.il` או כל כתובת אחרת שמאושרת על ידי IT.

### Q: מה אם אין לי גישה לשרת הפנימי?
**A:** דבר עם מחלקת ה-IT. הם יכולים:
1. לאשר את ה-IP שלך לשליחה
2. ליצור לך חשבון שירות
3. להגדיר SMTP Relay ייעודי

### Q: האם המייל ישלח לכתובות מחוץ לארגון?
**A:** תלוי בהגדרות השרת. בדרך כלל, שרתים פנימיים מאפשרים שליחה לכל כתובת, אבל כדאי לבדוק עם IT.

### Q: מה אם אני רוצה לבדוק בלי להגדיר מייל?
**A:** השתמש ב-`get_reset_token.py` - זה יראה לך את הטוקן ישירות מהמסד נתונים:
```bash
python get_reset_token.py
```

### Q: איך אני יודע שהמייל נשלח?
**A:** בדוק את הלוגים בטרמינל. אמור להופיע:
```
INFO:src.email_service:✓ מייל נשלח בהצלחה ל-user@example.com
```

---

## 🎨 התאמה אישית

### שינוי עיצוב המייל

ערוך את `src/email_service.py`:
- תוכן ה-HTML במשתנה `html_content`
- עיצוב CSS ב-`<style>` tag

### הוספת לוגו

הוסף `<img>` tag ב-HTML:
```html
<img src="https://your-domain.com/logo.png" alt="Logo" style="max-width: 150px;" />
```

### שינוי שם השולח

ערוך ב-.env:
```env
FROM_NAME=מערכת אבטחת מידע - משרד העבודה והרווחה
```

---

## 🔐 אבטחה

### המלצות חובה:

1. ✅ **אל תשתף את .env** - יש שם סיסמאות!
2. ✅ **השתמש ב-App Password** - לא בסיסמה רגילה
3. ✅ **הוסף .env ל-.gitignore**
4. ✅ **החלף סיסמאות באופן קבוע**
5. ✅ **השתמש ב-HTTPS בפרודקשן**

### קובץ .gitignore

ודא שקיים:
```
.env
*.pyc
__pycache__/
*.log
```

---

## 📞 קבלת עזרה

אם אף אחת מהאפשרויות לא עובדת:

1. **בדוק לוגים** - הלוגים מראים בדיוק מה השגיאה
2. **צור קשר עם IT** - הם יכולים לעזור עם ההגדרות
3. **השתמש בחלופה** - `get_reset_token.py` לקבלת טוקן ידנית
4. **פנה לתמיכה** - AsafV@molsa.gov.il

---

## 📊 הסבר טכני - איך זה עובד?

### תהליך שליחת מייל:

1. **משתמש מבקש איפוס סיסמה**
2. Backend יוצר טוקן אקראי (32 תווים)
3. הטוקן נשמר במסד הנתונים עם תוקף 24 שעות
4. **email_service.py** שולח מייל HTML מעוצב
5. המייל כולל את הטוקן ולינק (אופציונלי)
6. המשתמש מזין את הטוקן + סיסמה חדשה
7. הטוקן מסומן כמנוצל

### סוגי מיילים שהמערכת שולחת:

1. **איפוס סיסמה** - מייל עם קוד 32 תווים
2. **בקשת סריקה** - מייל מפורט לצוות האבטחה

---

**עודכן:** נובמבר 2024  
**גרסה:** 2.0  
**תחזוקה:** פעילה



