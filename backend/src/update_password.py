"""
סקריפט עדכון סיסמה - כלי שורת פקודה לעדכון סיסמאות משתמשים
דף זה מיועד ל:
- עדכון סיסמאות משתמשים קיימים במסד הנתונים
- הצפנת סיסמאות לפני שמירה
- בדיקת קיום משתמש לפני עדכון
- כלי ניהול למנהלי מערכת
"""
import sys
import os
import logging
from getpass import getpass

# הבטחת הימצאות תיקיית src בנתיב הייבוא
SRC_DIR = os.path.dirname(os.path.abspath(__file__))
if SRC_DIR not in sys.path:
    sys.path.append(SRC_DIR)

from database import SecurityScansDatabase

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_user_password():
    """
    מעדכן סיסמה עבור משתמש קיים.
    """
    logger.info("מתחיל תהליך עדכון סיסמה...")
    
    db = None
    try:
        username = input("הכנס שם משתמש לעדכון: ")
        password = getpass("הכנס סיסמה חדשה: ")
        password_confirm = getpass("הכנס סיסמה חדשה שוב לאישור: ")

        if password != password_confirm:
            logger.error("הסיסמאות אינן תואמות. התהליך בוטל.")
            return

        db = SecurityScansDatabase()
        if not db.connect():
            logger.error("ההתחברות למסד הנתונים נכשלה. התהליך בוטל.")
            return

        # בדיקה אם המשתמש קיים
        users = db.execute_query("SELECT UserID FROM Users WHERE Username = ?", (username,))

        if not users:
            logger.warning(f"משתמש '{username}' לא נמצא במסד הנתונים.")
            return

        user_id = users[0]['UserID']
        
        # הצפנת הסיסמה החדשה
        hashed_password = db.set_password(password)
        
        # עדכון מסד הנתונים
        db.execute_non_query(
            "UPDATE Users SET Password = ? WHERE UserID = ?",
            (hashed_password, user_id)
        )
        
        logger.info(f"הסיסמה עבור משתמש '{username}' עודכנה בהצלחה.")

    except Exception as e:
        logger.error(f"אירעה שגיאה בתהליך עדכון הסיסמה: {e}")
    
    finally:
        if db and db.connection:
            db.connection.close()
            logger.info("חיבור למסד הנתונים נסגר.")

if __name__ == '__main__':
    update_user_password() 