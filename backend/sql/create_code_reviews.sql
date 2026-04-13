-- =============================================================================
-- PT Services Backend - סקריפט יצירת טבלאות Code Review
-- הרץ סקריפט זה על ידי DBA להקמת טבלאות סריקת קוד
-- =============================================================================

-- הערה: וודא שאתה מחובר למסד הנתונים הנכון לפני הרצת הסקריפט
-- USE SA_DTI_Security_NiktoWebServerScanner;
-- GO

-- =============================================================================
-- הרחבת טבלת Systems - הוספת שדות RepoURL ו-Branch
-- =============================================================================
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Systems' AND COLUMN_NAME = 'RepoURL'
)
BEGIN
    ALTER TABLE Systems ADD RepoURL NVARCHAR(500) NULL;
    PRINT N'עמודת RepoURL נוספה לטבלת Systems';
END
ELSE
    PRINT N'עמודת RepoURL כבר קיימת בטבלת Systems';
GO

IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Systems' AND COLUMN_NAME = 'Branch'
)
BEGIN
    ALTER TABLE Systems ADD Branch NVARCHAR(100) DEFAULT 'master';
    PRINT N'עמודת Branch נוספה לטבלת Systems';
END
ELSE
    PRINT N'עמודת Branch כבר קיימת בטבלת Systems';
GO

-- =============================================================================
-- טבלת סריקות קוד
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CodeReviews')
BEGIN
    CREATE TABLE CodeReviews (
        TaskID INT IDENTITY(1,1) PRIMARY KEY,
        SystemID INT NOT NULL REFERENCES Systems(SystemID),
        RepoURL NVARCHAR(500) NOT NULL,
        Branch NVARCHAR(100) NOT NULL,
        Status NVARCHAR(20) DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Succeeded','Failed')),
        CreatedAt DATETIME DEFAULT GETDATE(),
        StartedAt DATETIME NULL,
        FinishedAt DATETIME NULL,
        ErrorSummary NVARCHAR(MAX) NULL,
        InitiatedBy INT NULL REFERENCES Users(UserID)
    );
    
    CREATE INDEX IX_CodeReviews_SystemID ON CodeReviews(SystemID);
    CREATE INDEX IX_CodeReviews_Status ON CodeReviews(Status);
    CREATE INDEX IX_CodeReviews_CreatedAt ON CodeReviews(CreatedAt DESC);
    
    PRINT N'טבלת CodeReviews נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת CodeReviews כבר קיימת';
GO

-- הוספת עמודות ספירת ממצאים (snapshot) לטבלת CodeReviews
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CodeReviews' AND COLUMN_NAME = 'TotalCount'
)
BEGIN
    ALTER TABLE CodeReviews ADD TotalCount INT DEFAULT 0;
    ALTER TABLE CodeReviews ADD CriticalCount INT DEFAULT 0;
    ALTER TABLE CodeReviews ADD HighCount INT DEFAULT 0;
    ALTER TABLE CodeReviews ADD MediumCount INT DEFAULT 0;
    ALTER TABLE CodeReviews ADD LowCount INT DEFAULT 0;
    PRINT N'עמודות ספירת ממצאים נוספו לטבלת CodeReviews';
END
ELSE
    PRINT N'עמודות ספירת ממצאים כבר קיימות בטבלת CodeReviews';
GO

-- =============================================================================
-- טבלת ממצאי סריקת קוד
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CodeReviewFindings')
BEGIN
    CREATE TABLE CodeReviewFindings (
        FindingID INT IDENTITY(1,1) PRIMARY KEY,
        TaskID INT NOT NULL REFERENCES CodeReviews(TaskID),
        FindingCode NVARCHAR(20),
        Title NVARCHAR(500),
        Description NVARCHAR(MAX),
        Severity NVARCHAR(20) CHECK (Severity IN ('Critical','High','Medium','Low')),
        Probability NVARCHAR(20),
        Risk NVARCHAR(20),
        FilePath NVARCHAR(500),
        LineNumber INT NULL,
        CodeSnippet NVARCHAR(MAX),
        Recommendation NVARCHAR(MAX),
        Tags NVARCHAR(500),
        Status NVARCHAR(20) DEFAULT N'בטיפול' CHECK (Status IN (N'בטיפול', N'טופל', N'התעלם', N'סגור'))
    );
    
    CREATE INDEX IX_CodeReviewFindings_TaskID ON CodeReviewFindings(TaskID);
    CREATE INDEX IX_CodeReviewFindings_Severity ON CodeReviewFindings(Severity);
    CREATE INDEX IX_CodeReviewFindings_Status ON CodeReviewFindings(Status);
    CREATE INDEX IX_CodeReviewFindings_FindingCode ON CodeReviewFindings(FindingCode);
    
    PRINT N'טבלת CodeReviewFindings נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת CodeReviewFindings כבר קיימת';
GO

-- =============================================================================
-- טבלת Artifacts של סריקת קוד (דוחות HTML, לוגים וכו')
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CodeReviewArtifacts')
BEGIN
    CREATE TABLE CodeReviewArtifacts (
        ArtifactID INT IDENTITY(1,1) PRIMARY KEY,
        TaskID INT NOT NULL REFERENCES CodeReviews(TaskID),
        ArtifactName NVARCHAR(200),
        MimeType NVARCHAR(100),
        Content VARBINARY(MAX),
        CreatedAt DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_CodeReviewArtifacts_TaskID ON CodeReviewArtifacts(TaskID);
    
    PRINT N'טבלת CodeReviewArtifacts נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת CodeReviewArtifacts כבר קיימת';
GO

PRINT N'';
PRINT N'=============================================================================';
PRINT N'סקריפט יצירת טבלאות Code Review הסתיים בהצלחה';
PRINT N'=============================================================================';
GO
