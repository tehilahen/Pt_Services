-- =============================================================================
-- PT Services Backend - מעקב סריקות PT ידניות (חוסן)
-- הרץ סקריפט זה ידנית על ה-DB לאחר יצירת טבלת Systems
-- =============================================================================

-- =============================================================================
-- טבלת מעקב PT ידני (מקושרת ל-Systems)
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ManualPTTracking')
BEGIN
    CREATE TABLE ManualPTTracking (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SystemID INT NOT NULL,
        LastPTDate DATE NULL,
        NextCheckDate DATE NULL,
        SystemManagers NVARCHAR(500) NULL,
        SensitivityLevel NVARCHAR(50) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT N'הכנה'
            CHECK (Status IN (N'הכנה', N'התנעה', N'בבדיקה', N'הסתיים')),
        CONSTRAINT FK_ManualPTTracking_Systems FOREIGN KEY (SystemID) REFERENCES Systems(SystemID),
        CONSTRAINT UQ_ManualPTTracking_SystemID UNIQUE (SystemID)
    );

    CREATE INDEX IX_ManualPTTracking_NextCheckDate ON ManualPTTracking(NextCheckDate);

    PRINT N'טבלת ManualPTTracking נוצרה בהצלחה';
END
ELSE
    PRINT N'טבלת ManualPTTracking כבר קיימת';
GO

-- =============================================================================
-- Trigger: עדכון אוטומטי של NextCheckDate כאשר LastPTDate מתעדכן
-- (תאריך בדיקה הבא = PT אחרון + 18 חודשים)
-- =============================================================================
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_ManualPTTracking_SetNextCheckDate')
    DROP TRIGGER TR_ManualPTTracking_SetNextCheckDate;
GO

CREATE TRIGGER TR_ManualPTTracking_SetNextCheckDate
ON ManualPTTracking
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE m
    SET m.NextCheckDate = DATEADD(MONTH, 18, i.LastPTDate)
    FROM ManualPTTracking m
    INNER JOIN inserted i ON m.Id = i.Id
    WHERE i.LastPTDate IS NOT NULL;
END;
GO

PRINT N'Trigger TR_ManualPTTracking_SetNextCheckDate נוצר בהצלחה';
PRINT N'';
PRINT N'=============================================================================';
PRINT N'סקריפט ManualPTTracking הסתיים. הרץ ידנית על ה-DB.';
PRINT N'=============================================================================';
GO
