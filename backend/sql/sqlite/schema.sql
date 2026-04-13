-- PT Services - SQLite schema (local demo / school presentation)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS UsersType (
    UserTypeID INTEGER PRIMARY KEY,
    Description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Users (
    UserID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserName TEXT NOT NULL UNIQUE,
    Password TEXT NOT NULL,
    Email TEXT,
    FullName TEXT,
    UserTypeID INTEGER DEFAULT 1 REFERENCES UsersType(UserTypeID),
    IsActive INTEGER NOT NULL DEFAULT 1,
    CreatedDate TEXT DEFAULT (datetime('now', 'localtime')),
    LastLoginDate TEXT
);

CREATE TABLE IF NOT EXISTS PasswordResets (
    ResetID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL REFERENCES Users(UserID),
    ResetToken TEXT NOT NULL UNIQUE,
    ExpiryDate TEXT NOT NULL,
    IsUsed INTEGER NOT NULL DEFAULT 0,
    CreatedDate TEXT DEFAULT (datetime('now', 'localtime')),
    UsedDate TEXT
);
CREATE INDEX IF NOT EXISTS IX_PasswordResets_Token ON PasswordResets(ResetToken);

CREATE TABLE IF NOT EXISTS Systems (
    SystemID INTEGER PRIMARY KEY AUTOINCREMENT,
    SystemName TEXT NOT NULL,
    IPAddress TEXT,
    Port INTEGER DEFAULT 80,
    URL TEXT,
    SystemManager TEXT,
    Email TEXT,
    RepoURL TEXT,
    Branch TEXT DEFAULT 'master',
    CreatedDate TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS IX_Systems_IP_Port ON Systems(IPAddress, Port) WHERE IPAddress IS NOT NULL;

CREATE TABLE IF NOT EXISTS SystemsUsers (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    UserID INTEGER NOT NULL REFERENCES Users(UserID),
    SystemID INTEGER NOT NULL REFERENCES Systems(SystemID),
    UNIQUE(UserID, SystemID)
);

CREATE TABLE IF NOT EXISTS Scans (
    ScansID INTEGER PRIMARY KEY AUTOINCREMENT,
    SystemID INTEGER NOT NULL REFERENCES Systems(SystemID),
    ScanDate TEXT DEFAULT (datetime('now', 'localtime')),
    start_date TEXT,
    End_date TEXT,
    Status TEXT CHECK (Status IN ('נכשל', 'הצליח', 'מתחיל')),
    Duration INTEGER,
    Confidance TEXT,
    ScanSource TEXT DEFAULT 'Nikto'
);
CREATE INDEX IF NOT EXISTS IX_Scans_SystemID ON Scans(SystemID);
CREATE INDEX IF NOT EXISTS IX_Scans_ScanDate ON Scans(ScanDate DESC);

CREATE TABLE IF NOT EXISTS Vulnerabilities (
    VulnerabilityID INTEGER PRIMARY KEY AUTOINCREMENT,
    ScanID INTEGER NOT NULL REFERENCES Scans(ScansID),
    Description TEXT,
    [References] TEXT,
    CVSS REAL,
    CVE TEXT,
    Severity TEXT CHECK (Severity IN ('Critical', 'High', 'Medium', 'Low')),
    Status TEXT DEFAULT 'בטיפול' CHECK (Status IN ('בטיפול', 'טופל', 'התעלם', 'סגור'))
);
CREATE INDEX IF NOT EXISTS IX_Vulnerabilities_ScanID ON Vulnerabilities(ScanID);
CREATE INDEX IF NOT EXISTS IX_Vulnerabilities_Severity ON Vulnerabilities(Severity);
CREATE INDEX IF NOT EXISTS IX_Vulnerabilities_Status ON Vulnerabilities(Status);

CREATE TABLE IF NOT EXISTS ManualPTTracking (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SystemID INTEGER NOT NULL UNIQUE REFERENCES Systems(SystemID),
    LastPTDate TEXT,
    NextCheckDate TEXT,
    SystemManagers TEXT,
    SensitivityLevel TEXT,
    Status TEXT NOT NULL DEFAULT 'הכנה'
        CHECK (Status IN ('הכנה', 'התנעה', 'בבדיקה', 'הסתיים'))
);
CREATE INDEX IF NOT EXISTS IX_ManualPTTracking_NextCheckDate ON ManualPTTracking(NextCheckDate);

CREATE TRIGGER IF NOT EXISTS TR_ManualPTTracking_AfterInsert
AFTER INSERT ON ManualPTTracking
FOR EACH ROW
WHEN NEW.LastPTDate IS NOT NULL
BEGIN
    UPDATE ManualPTTracking
    SET NextCheckDate = date(NEW.LastPTDate, '+18 months')
    WHERE Id = NEW.Id;
END;

CREATE TRIGGER IF NOT EXISTS TR_ManualPTTracking_AfterUpdate
AFTER UPDATE OF LastPTDate ON ManualPTTracking
FOR EACH ROW
WHEN NEW.LastPTDate IS NOT NULL
BEGIN
    UPDATE ManualPTTracking
    SET NextCheckDate = date(NEW.LastPTDate, '+18 months')
    WHERE Id = NEW.Id;
END;

CREATE TABLE IF NOT EXISTS CodeReviews (
    TaskID INTEGER PRIMARY KEY AUTOINCREMENT,
    SystemID INTEGER NOT NULL REFERENCES Systems(SystemID),
    RepoURL TEXT NOT NULL,
    Branch TEXT NOT NULL,
    Status TEXT DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Succeeded','Failed')),
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime')),
    StartedAt TEXT,
    FinishedAt TEXT,
    ErrorSummary TEXT,
    InitiatedBy INTEGER REFERENCES Users(UserID),
    TotalCount INTEGER DEFAULT 0,
    CriticalCount INTEGER DEFAULT 0,
    HighCount INTEGER DEFAULT 0,
    MediumCount INTEGER DEFAULT 0,
    LowCount INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS IX_CodeReviews_SystemID ON CodeReviews(SystemID);
CREATE INDEX IF NOT EXISTS IX_CodeReviews_Status ON CodeReviews(Status);
CREATE INDEX IF NOT EXISTS IX_CodeReviews_CreatedAt ON CodeReviews(CreatedAt DESC);

CREATE TABLE IF NOT EXISTS CodeReviewFindings (
    FindingID INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskID INTEGER NOT NULL REFERENCES CodeReviews(TaskID),
    FindingCode TEXT,
    Title TEXT,
    Description TEXT,
    Severity TEXT CHECK (Severity IN ('Critical','High','Medium','Low')),
    Probability TEXT,
    Risk TEXT,
    FilePath TEXT,
    LineNumber INTEGER,
    CodeSnippet TEXT,
    Recommendation TEXT,
    Tags TEXT,
    Status TEXT DEFAULT 'בטיפול' CHECK (Status IN ('בטיפול', 'טופל', 'התעלם', 'סגור'))
);
CREATE INDEX IF NOT EXISTS IX_CodeReviewFindings_TaskID ON CodeReviewFindings(TaskID);
CREATE INDEX IF NOT EXISTS IX_CodeReviewFindings_Severity ON CodeReviewFindings(Severity);
CREATE INDEX IF NOT EXISTS IX_CodeReviewFindings_Status ON CodeReviewFindings(Status);
CREATE INDEX IF NOT EXISTS IX_CodeReviewFindings_FindingCode ON CodeReviewFindings(FindingCode);

CREATE TABLE IF NOT EXISTS CodeReviewArtifacts (
    ArtifactID INTEGER PRIMARY KEY AUTOINCREMENT,
    TaskID INTEGER NOT NULL REFERENCES CodeReviews(TaskID),
    ArtifactName TEXT,
    MimeType TEXT,
    Content BLOB,
    CreatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS IX_CodeReviewArtifacts_TaskID ON CodeReviewArtifacts(TaskID);
