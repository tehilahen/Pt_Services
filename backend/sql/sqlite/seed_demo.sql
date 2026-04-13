-- Demo data for school presentation (login: admin / Admin123!)
INSERT OR IGNORE INTO UsersType (UserTypeID, Description) VALUES
    (1, 'Admin'),
    (2, 'System Manager'),
    (3, 'Super Manager');

-- Password is Admin123! (werkzeug scrypt hash)
INSERT OR IGNORE INTO Users (UserID, UserName, Password, Email, FullName, UserTypeID, IsActive)
VALUES (
    1,
    'admin',
    'scrypt:32768:8:1$qYcUC81Ers5U9IlR$ccb5202ed246a792b2bf6a0c95a5130756cb1a8c16a93fddf57b20305f9e0bddbb42f9c6f3ffff5cf22593926279f6529699d45947d6404cc927ec42d0e13dd9',
    'admin@demo.local',
    'מנהל דמו',
    1,
    1
);

INSERT OR IGNORE INTO Systems (SystemID, SystemName, IPAddress, Port, URL, SystemManager, Email, RepoURL, Branch)
VALUES
    (1, 'אתר דמו פנימי', '192.168.1.10', 443, 'https://demo.internal', 'מנהל דמו', 'sys1@demo.local', 'https://dev.azure.com/demo/demo-project/_git/web-app', 'main'),
    (2, 'API שירותים', '192.168.1.20', 8080, 'http://api.demo.internal:8080', 'מנהל דמו', 'sys2@demo.local', 'https://dev.azure.com/demo/demo-project/_git/api', 'develop'),
    (3, 'פורטל תלמידים', '192.168.1.30', 443, 'https://students.demo.internal', 'מנהל דמו', 'sys3@demo.local', 'https://dev.azure.com/demo/demo-project/_git/students-portal', 'main'),
    (4, 'מערכת ניהול ציונים', '192.168.1.40', 8443, 'https://grades.demo.internal:8443', 'מנהל דמו', 'sys4@demo.local', 'https://dev.azure.com/demo/demo-project/_git/grades-service', 'release'),
    (5, 'שירות זיהוי משתמשים', '192.168.1.50', 9000, 'http://identity.demo.internal:9000', 'מנהל דמו', 'sys5@demo.local', 'https://dev.azure.com/demo/demo-project/_git/identity', 'develop'),
    (6, 'מערכת דיווח נוכחות', '192.168.1.60', 443, 'https://attendance.demo.internal', 'מנהל דמו', 'sys6@demo.local', 'https://dev.azure.com/demo/demo-project/_git/attendance', 'main');

INSERT OR IGNORE INTO SystemsUsers (UserID, SystemID)
VALUES
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),
    (1, 5),
    (1, 6);

INSERT OR IGNORE INTO Scans (ScansID, SystemID, ScanDate, start_date, End_date, Status, Duration, Confidance, ScanSource)
VALUES
    (1, 1, '2026-04-11 10:00:00', '2026-04-11 10:00:00', '2026-04-11 10:30:00', 'הצליח', 1800, 'high', 'Nikto'),
    (2, 2, '2026-04-12 14:00:00', '2026-04-12 14:00:00', '2026-04-12 14:20:00', 'הצליח', 1200, 'medium', 'Nikto');

INSERT OR IGNORE INTO Vulnerabilities (VulnerabilityID, ScanID, Description, [References], CVSS, CVE, Severity, Status)
VALUES
    (1, 1, 'X-Powered-By header exposes server technology', 'https://owasp.org', 5.3, 'CVE-2020-0001', 'Medium', 'בטיפול'),
    (2, 1, 'Missing X-Content-Type-Options header', 'https://owasp.org', 4.3, NULL, 'Medium', 'בטיפול'),
    (3, 1, 'SSL certificate hostname mismatch', 'RFC 6125', 7.4, NULL, 'High', 'בטיפול'),
    (4, 2, 'Directory listing enabled on /backup/', NULL, 8.6, NULL, 'High', 'טופל'),
    (5, 2, 'Outdated TLS 1.0 supported', NULL, 7.5, 'CVE-2011-3389', 'High', 'בטיפול');

INSERT OR IGNORE INTO ManualPTTracking (Id, SystemID, LastPTDate, NextCheckDate, SystemManagers, SensitivityLevel, Status)
VALUES (1, 1, date('now', '-6 months'), date('now', '+12 months'), 'מנהל דמו', 'גבוהה', 'התנעה');
