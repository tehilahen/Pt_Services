-- =============================================================================
-- PT Services Backend - יצירת משתמש Admin ברירת מחדל
-- הרץ סקריפט זה פעם אחת בלבד להקמה ראשונית
-- =============================================================================

-- הערה: וודא שאתה מחובר למסד הנתונים הנכון לפני הרצת הסקריפט
-- USE SA_DTI_Security_NiktoWebServerScanner;
-- GO

-- =============================================================================
-- בדיקה אם משתמש admin קיים
-- =============================================================================
IF NOT EXISTS (SELECT * FROM Users WHERE UserName = 'admin')
BEGIN
    -- יצירת משתמש admin עם סיסמה מוצפנת
    -- הסיסמה הראשונית היא: Admin123!
    -- מומלץ לשנות את הסיסמה מיד לאחר ההתחברות הראשונה
    
    -- הערה חשובה: הסיסמה למטה מוצפנת עם Werkzeug scrypt
    -- יש ליצור סיסמה חדשה באמצעות Python:
    -- from werkzeug.security import generate_password_hash
    -- print(generate_password_hash('YourSecurePassword123!'))
    
    INSERT INTO Users (
        UserName, 
        Password, 
        Email, 
        FullName, 
        UserTypeID, 
        IsActive
    ) VALUES (
        'admin',
        -- *** יש להחליף את הסיסמה המוצפנת הבאה בסיסמה שנוצרה מקומית ***
        'scrypt:32768:8:1$placeholder$placeholder',
        'admin@example.com',
        N'מנהל מערכת',
        1,  -- Admin
        1   -- Active
    );
    
    PRINT N'משתמש admin נוצר בהצלחה';
    PRINT N'*** חשוב: עדכן את הסיסמה המוצפנת בסקריפט זה או אפס את הסיסמה לאחר יצירת המשתמש ***';
END
ELSE
BEGIN
    PRINT N'משתמש admin כבר קיים במערכת';
END
GO

-- =============================================================================
-- הוראות ליצירת סיסמה מוצפנת
-- =============================================================================
/*
כדי ליצור סיסמה מוצפנת חדשה, הרץ את הפקודה הבאה ב-Python:

from werkzeug.security import generate_password_hash
password = 'YourSecurePassword123!'  # החלף בסיסמה שלך
hashed = generate_password_hash(password)
print(hashed)

לאחר מכן, עדכן את הסיסמה באמצעות:

UPDATE Users 
SET Password = 'הסיסמה_המוצפנת_שנוצרה'
WHERE UserName = 'admin';

או השתמש בסקריפט Python:
python -c "from src.database import db_connection; from werkzeug.security import generate_password_hash; db_connection.connect(); db_connection.execute_non_query('UPDATE Users SET Password = ? WHERE UserName = ?', (generate_password_hash('Admin123!'), 'admin'))"
*/
GO

PRINT N'';
PRINT N'=============================================================================';
PRINT N'סקריפט seed_admin_user הסתיים';
PRINT N'=============================================================================';
GO

