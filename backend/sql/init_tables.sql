-- =============================================================================
-- PT Services Backend - סקריפט יצירת טבלאות
-- הרץ סקריפט זה על ידי DBA להקמת מסד הנתונים
-- =============================================================================

-- הערה: וודא שאתה מחובר למסד הנתונים הנכון לפני הרצת הסקריפט
-- USE SA_DTI_Security_NiktoWebServerScanner;
-- GO

-- =============================================================================
-- טבלת סוגי משתמשים
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UsersType')
BEGIN
    CREATE TABLE UsersType (
        UserTypeID INT PRIMARY KEY,
        Description NVARCHAR(100) NOT NULL
    );
    
    -- הוספת סוגי משתמשים ברירת מחדל
    INSERT INTO UsersType (UserTypeID, Description) VALUES
        (1, N'Admin'),
        (2, N'System Manager'),
        (3, N'Super Manager');
    
    PRINT N'טבלת UsersType נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת UsersType כבר קיימת';
GO

-- =============================================================================
-- טבלת משתמשים
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserID INT IDENTITY(1,1) PRIMARY KEY,
        UserName NVARCHAR(50) NOT NULL UNIQUE,
        Password NVARCHAR(255) NOT NULL,
        Email NVARCHAR(100),
        FullName NVARCHAR(100),
        UserTypeID INT DEFAULT 1 REFERENCES UsersType(UserTypeID),
        IsActive BIT DEFAULT 1,
        CreatedDate DATETIME DEFAULT GETDATE(),
        LastLoginDate DATETIME NULL
    );
    
    PRINT N'טבלת Users נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת Users כבר קיימת';
GO

-- =============================================================================
-- טבלת איפוס סיסמאות
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PasswordResets')
BEGIN
    CREATE TABLE PasswordResets (
        ResetID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID),
        ResetToken NVARCHAR(64) NOT NULL UNIQUE,
        ExpiryDate DATETIME NOT NULL,
        IsUsed BIT DEFAULT 0,
        CreatedDate DATETIME DEFAULT GETDATE(),
        UsedDate DATETIME NULL
    );
    
    -- יצירת אינדקס לחיפוש מהיר לפי טוקן
    CREATE INDEX IX_PasswordResets_Token ON PasswordResets(ResetToken);
    
    PRINT N'טבלת PasswordResets נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת PasswordResets כבר קיימת';
GO

-- =============================================================================
-- טבלת מערכות
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Systems')
BEGIN
    CREATE TABLE Systems (
        SystemID INT IDENTITY(1,1) PRIMARY KEY,
        SystemName NVARCHAR(100) NOT NULL,
        IPAddress NVARCHAR(50),
        Port INT DEFAULT 80,
        URL NVARCHAR(500),
        SystemManager NVARCHAR(100),
        Email NVARCHAR(100),
        CreatedDate DATETIME DEFAULT GETDATE()
    );
    
    -- יצירת אינדקס ייחודי על IP + Port
    CREATE UNIQUE INDEX IX_Systems_IP_Port ON Systems(IPAddress, Port) WHERE IPAddress IS NOT NULL;
    
    PRINT N'טבלת Systems נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת Systems כבר קיימת';
GO

-- =============================================================================
-- טבלת קישור משתמשים-מערכות
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemsUsers')
BEGIN
    CREATE TABLE SystemsUsers (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID),
        SystemID INT NOT NULL REFERENCES Systems(SystemID),
        UNIQUE(UserID, SystemID)
    );
    
    PRINT N'טבלת SystemsUsers נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת SystemsUsers כבר קיימת';
GO

-- =============================================================================
-- טבלת סריקות
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Scans')
BEGIN
    CREATE TABLE Scans (
        ScansID INT IDENTITY(1,1) PRIMARY KEY,
        SystemID INT NOT NULL REFERENCES Systems(SystemID),
        ScanDate DATETIME DEFAULT GETDATE(),
        start_date DATETIME,
        End_date DATETIME,
        Status NVARCHAR(20) CHECK (Status IN (N'נכשל', N'הצליח', N'מתחיל')),
        Duration INT,
        Confidance NVARCHAR(20)
    );
    
    -- יצירת אינדקס לחיפוש מהיר לפי מערכת
    CREATE INDEX IX_Scans_SystemID ON Scans(SystemID);
    CREATE INDEX IX_Scans_ScanDate ON Scans(ScanDate DESC);
    
    PRINT N'טבלת Scans נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת Scans כבר קיימת';
GO

-- =============================================================================
-- טבלת חולשות
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Vulnerabilities')
BEGIN
    CREATE TABLE Vulnerabilities (
        VulnerabilityID INT IDENTITY(1,1) PRIMARY KEY,
        ScanID INT NOT NULL REFERENCES Scans(ScansID),
        Description NVARCHAR(MAX),
        [References] NVARCHAR(MAX),
        CVSS DECIMAL(3,1),
        CVE NVARCHAR(50),
        Severity NVARCHAR(20) CHECK (Severity IN ('Critical', 'High', 'Medium', 'Low')),
        Status NVARCHAR(20) DEFAULT N'בטיפול' CHECK (Status IN (N'בטיפול', N'טופל', N'התעלם', N'סגור'))
    );
    
    -- יצירת אינדקסים לחיפוש מהיר
    CREATE INDEX IX_Vulnerabilities_ScanID ON Vulnerabilities(ScanID);
    CREATE INDEX IX_Vulnerabilities_Severity ON Vulnerabilities(Severity);
    CREATE INDEX IX_Vulnerabilities_Status ON Vulnerabilities(Status);
    
    PRINT N'טבלת Vulnerabilities נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת Vulnerabilities כבר קיימת';
GO

-- =============================================================================
-- וידוא עמודת Status בטבלת Vulnerabilities
-- =============================================================================
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Vulnerabilities' AND COLUMN_NAME = 'Status'
)
BEGIN
    ALTER TABLE Vulnerabilities 
    ADD Status NVARCHAR(20) DEFAULT N'בטיפול';
    
    PRINT N'עמודת Status נוספה לטבלת Vulnerabilities';
END
GO

PRINT N'';
PRINT N'=============================================================================';
PRINT N'סקריפט יצירת טבלאות הסתיים בהצלחה';
PRINT N'=============================================================================';
GO

