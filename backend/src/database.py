"""
ניהול מסד נתונים SQLite - כל הפונקציות לעבודה עם מסד הנתונים
דף זה אחראי על:
- חיבור לקובץ SQLite מקומי (דמו / מצב בית ספר)
- ניהול מערכות (Systems) - יצירה, עדכון, שליפה
- ניהול סריקות (Scans) - יצירה, עדכון סטטוס, שליפה
- ניהול חולשות (Vulnerabilities) - הוספה, שליפה לפי מערכת/סריקה
- ניהול משתמשים (Users) - אימות, איפוס סיסמה, ניהול טוקנים
- סטטיסטיקות ודוחות
"""
import sqlite3
import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta
import logging
from src.timezone_utils import get_israel_time
import threading
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import string

# טעינת משתני הסביבה
load_dotenv()

# הגדרת לוגים - שונה ל-INFO לשיפור ביצועים (במקום DEBUG)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_SQLITE_DIR = Path(__file__).resolve().parent.parent / "sql" / "sqlite"


class SecurityScansDatabase:
    def __init__(self):
        """אתחול נתיב קובץ SQLite (ברירת מחדל: backend/data/demo.sqlite)."""
        default_db = Path(__file__).resolve().parent.parent / "data" / "demo.sqlite"
        self.db_path = os.path.abspath(os.getenv("SQLITE_DB_PATH", str(default_db)))
        self.database = self.db_path
        self.connection = None
        self._lock = threading.Lock()
        self._cache = {}
        self._cache_ttl = 60

    def connect(self):
        """חיבור ל-SQLite ויצירת סכימה/נתוני דמה בפעם הראשונה."""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
            self.connection.execute("PRAGMA foreign_keys = ON")
            self._ensure_sqlite_schema()
            logger.info("התחברות ל-SQLite הצליחה: %s", self.db_path)
            return True
        except Exception as e:
            logger.error("שגיאה בהתחברות ל-SQLite: %s", str(e))
            return False

    def _ensure_sqlite_schema(self):
        cur = self.connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='Users'"
        )
        if not cur.fetchone():
            schema_path = _SQLITE_DIR / "schema.sql"
            seed_path = _SQLITE_DIR / "seed_demo.sql"
            logger.info("מאתחל מסד SQLite מ-%s", schema_path)
            with open(schema_path, encoding="utf-8") as f:
                self.connection.executescript(f.read())
            if seed_path.is_file():
                with open(seed_path, encoding="utf-8") as f:
                    self.connection.executescript(f.read())
            self.connection.commit()
        self.create_tables()

    # ===============================
    # מנגנון Cache לשיפור ביצועים
    # ===============================
    
    def _get_cached(self, key):
        """שליפת נתון מה-Cache אם קיים ולא פג תוקף"""
        cached = self._cache.get(key)
        if cached:
            cache_time = cached.get('time')
            if cache_time and (datetime.now() - cache_time).total_seconds() < self._cache_ttl:
                logger.debug(f"Cache hit for key: {key}")
                return cached.get('data')
            else:
                # פג תוקף - מחיקה מהקאש
                del self._cache[key]
        return None
    
    def _set_cache(self, key, data):
        """שמירת נתון ב-Cache"""
        self._cache[key] = {'data': data, 'time': datetime.now()}
        logger.debug(f"Cache set for key: {key}")
    
    def _clear_cache(self, key=None):
        """ניקוי Cache - מפתח ספציפי או כל ה-Cache"""
        if key:
            if key in self._cache:
                del self._cache[key]
        else:
            self._cache.clear()
        logger.debug(f"Cache cleared: {key if key else 'all'}")

    def ensure_database_exists(self):
        """תאימות לאחור — אתחול מתבצע ב-connect דרך _ensure_sqlite_schema."""
        if self.connection:
            self._ensure_sqlite_schema()

    def create_tables(self):
        """מיגרציות קלות לעמודות ישנות (SQLite)."""
        try:
            self.ensure_vulnerability_status_column()
            self.ensure_scan_source_column()
        except Exception as e:
            logger.error("שגיאה ב-create_tables: %s", str(e))

    def _sqlite_columns(self, table):
        rows = self.execute_query(f"PRAGMA table_info({table})")
        if not rows:
            return set()
        return {r.get("name") for r in rows}

    def execute_query(self, query, params=None):
        """ביצוע שאילתה עם החזרת תוצאות"""
        with self._lock:  # שימוש ב-lock למניעת concurrency issues
            cursor = None
            try:
                # בדיקת חיבור לפני ביצוע השאילתה
                if not self.connection or not self._test_connection_internal():
                    logger.warning("חיבור למסד הנתונים אבד - מנסה להתחבר מחדש")
                    if not self.connect():
                        logger.error("לא ניתן להתחבר למסד הנתונים")
                        return None
                
                cursor = self.connection.cursor()
                
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                columns = [column[0] for column in cursor.description] if cursor.description else []
                results = []
                
                # שליפת כל הנתונים בבת אחת
                rows = cursor.fetchall()
                for row in rows:
                    row_dict = {}
                    for i, value in enumerate(row):
                        row_dict[columns[i]] = value
                    results.append(row_dict)
                
                self.connection.commit()
                return results
                
            except Exception as e:
                logger.error(f"שגיאה בביצוע שאילתה: {str(e)}")
                return None
            finally:
                # וידוא סגירת הcursor
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass

    def execute_non_query(self, query, params=None):
        """ביצוע שאילתה ללא החזרת תוצאות"""
        with self._lock:  # שימוש ב-lock למניעת concurrency issues
            cursor = None
            try:
                logger.debug(f"Executing query: {query}")
                if params:
                    logger.debug(f"Query parameters: {params}")
                
                # בדיקת חיבור לפני ביצוע השאילתה
                if not self.connection or not self._test_connection_internal():
                    logger.warning("חיבור למסד הנתונים אבד - מנסה להתחבר מחדש")
                    if not self.connect():
                        logger.error("לא ניתן להתחבר למסד הנתונים")
                        return False
                        
                cursor = self.connection.cursor()
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                
                self.connection.commit()
                logger.debug("Query executed successfully and committed")
                return True
                
            except Exception as e:
                error_type = type(e).__name__
                error_message = str(e)
                error_args = e.args if hasattr(e, 'args') else None
                logger.error(f"שגיאה בביצוע שאילתה - Type: {error_type}, Message: {error_message}")
                logger.error(f"Query: {query}")
                if params:
                    logger.error(f"Parameters: {params}")
                if error_args:
                    logger.error(f"Error args: {error_args}")
                return False
            finally:
                # וידוא סגירת הcursor
                if cursor:
                    try:
                        cursor.close()
                    except:
                        pass

    # פונקציות עבודה עם מערכות
    def get_systems(self, user_id=None, user_type_id=None):
        """שליפת מערכות עם סיכומי סריקות - מסוננות לפי הרשאות משתמש - vulnerabilities רק מסריקה אחרונה
        אופטימיזציה: שימוש ב-CTE במקום subqueries מקוננים לשיפור ביצועים"""
        try:
            # Admin (1) ו-Super Manager (3) רואים את כל המערכות
            # System Manager (2) רואה רק מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                # System Manager - only systems assigned to them - אופטימיזציה עם CTE
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans 
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    ),
                    VulnCounts AS (
                        SELECT ls.SystemID, COUNT(v.VulnerabilityID) as vuln_count
                        FROM LatestScans ls
                        LEFT JOIN Vulnerabilities v ON v.ScanID = ls.LatestScanID
                        GROUP BY ls.SystemID
                    ),
                    ScanCounts AS (
                        SELECT SystemID, COUNT(ScansID) as scan_count, MAX(ScanDate) as last_scan_date
                        FROM Scans
                        GROUP BY SystemID
                    )
                    SELECT 
                        s.SystemID as id,
                        s.SystemName as name,
                        s.IPAddress as ip_address,
                        s.Port as port,
                        s.URL as url,
                        s.SystemManager as manager,
                        s.Email as email,
                        s.RepoURL as repo_url,
                        s.Branch as branch,
                        COALESCE(sct.scan_count, 0) as scan_count,
                        COALESCE(vc.vuln_count, 0) as total_vulnerabilities,
                        sct.last_scan_date
                    FROM Systems s
                    INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID
                    LEFT JOIN VulnCounts vc ON s.SystemID = vc.SystemID
                    LEFT JOIN ScanCounts sct ON s.SystemID = sct.SystemID
                    WHERE su.UserID = ?
                    ORDER BY s.SystemName
                """, (user_id,))
            else:
                # Admin or Super Manager - all systems - אופטימיזציה עם CTE
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans 
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    ),
                    VulnCounts AS (
                        SELECT ls.SystemID, COUNT(v.VulnerabilityID) as vuln_count
                        FROM LatestScans ls
                        LEFT JOIN Vulnerabilities v ON v.ScanID = ls.LatestScanID
                        GROUP BY ls.SystemID
                    ),
                    ScanCounts AS (
                        SELECT SystemID, COUNT(ScansID) as scan_count, MAX(ScanDate) as last_scan_date
                        FROM Scans
                        GROUP BY SystemID
                    )
                    SELECT 
                        s.SystemID as id,
                        s.SystemName as name,
                        s.IPAddress as ip_address,
                        s.Port as port,
                        s.URL as url,
                        s.SystemManager as manager,
                        s.Email as email,
                        s.RepoURL as repo_url,
                        s.Branch as branch,
                        COALESCE(sct.scan_count, 0) as scan_count,
                        COALESCE(vc.vuln_count, 0) as total_vulnerabilities,
                        sct.last_scan_date
                    FROM Systems s
                    LEFT JOIN VulnCounts vc ON s.SystemID = vc.SystemID
                    LEFT JOIN ScanCounts sct ON s.SystemID = sct.SystemID
                    ORDER BY s.SystemName
                """)
            
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for system in results:
                    if system.get('last_scan_date') and isinstance(system['last_scan_date'], datetime):
                        system['last_scan_date'] = system['last_scan_date'].isoformat()
            
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת מערכות: {str(e)}")
            return None

    def get_system_details(self, system_id):
        """שליפת פרטי מערכת ספציפית"""
        try:
            system_data = self.execute_query("""
                SELECT 
                    s.SystemID as id,
                    s.SystemName as name,
                    s.IPAddress as ip_address,
                    s.Port as port,
                    s.URL as url,
                    s.SystemManager as manager,
                    s.Email as email,
                    COUNT(DISTINCT sc.ScansID) as scan_count,
                    COUNT(DISTINCT v.VulnerabilityID) as total_vulnerabilities,
                    MAX(sc.ScanDate) as last_scan_date
                FROM Systems s
                LEFT JOIN Scans sc ON s.SystemID = sc.SystemID
                LEFT JOIN Vulnerabilities v ON sc.ScansID = v.ScanID
                WHERE s.SystemID = ?
                GROUP BY s.SystemID, s.SystemName, s.IPAddress, s.Port, s.URL, 
                         s.SystemManager, s.Email
            """, (system_id,))
            
            if not system_data:
                return None
            
            # Convert datetime objects to ISO format strings for JSON serialization
            system_info = system_data[0]
            if system_info.get('last_scan_date') and isinstance(system_info['last_scan_date'], datetime):
                system_info['last_scan_date'] = system_info['last_scan_date'].isoformat()

            scans = self.execute_query("""
                SELECT 
                    sc.ScansID as id,
                    sc.start_date,
                    sc.End_date,
                    sc.Status,
                    sc.Duration,
                    sc.ScanDate,
                    sc.Confidance as confidence,
                    COUNT(v.VulnerabilityID) as total_vulnerabilities
                FROM Scans sc
                LEFT JOIN Vulnerabilities v ON sc.ScansID = v.ScanID
                WHERE sc.SystemID = ?
                GROUP BY sc.ScansID, sc.start_date, sc.End_date, sc.Status, 
                         sc.Duration, sc.ScanDate, sc.Confidance
                ORDER BY sc.ScanDate DESC
            """, (system_id,))
            
            system_info['scans'] = scans or []
            return system_info
            
        except Exception as e:
            logger.error(f"שגיאה בשליפת פרטי מערכת: {str(e)}")
            return None

    def get_or_create_system(self, system_name, ip_address, port=80):
        """קבלת מערכת קיימת או יצירת מערכת חדשה"""
        try:
            # בדיקה אם המערכת קיימת
            existing_system = self.execute_query(
                "SELECT SystemID FROM Systems WHERE IPAddress = ? AND Port = ?",
                (ip_address, port)
            )
            
            if existing_system:
                system_id = existing_system[0]['SystemID']
                # עדכון שם המערכת אם שונה
                self.execute_non_query(
                    "UPDATE Systems SET SystemName = ? WHERE SystemID = ?",
                    (system_name, system_id)
                )
                logger.info(f"מערכת קיימת עודכנה: {system_name} (ID: {system_id})")
                return system_id
            else:
                # יצירת מערכת חדשה
                self.execute_non_query(
                    """INSERT INTO Systems (SystemName, IPAddress, Port) 
                       VALUES (?, ?, ?)""",
                    (system_name, ip_address, port)
                )
                
                # קבלת ה-ID של המערכת החדשה
                new_system = self.execute_query(
                    "SELECT SystemID FROM Systems WHERE IPAddress = ? AND Port = ? ORDER BY SystemID DESC LIMIT 1",
                    (ip_address, port)
                )
                
                if new_system:
                    system_id = new_system[0]['SystemID']
                    logger.info(f"מערכת חדשה נוצרה: {system_name} (ID: {system_id})")
                    return system_id
                
        except Exception as e:
            logger.error(f"שגיאה בטיפול במערכת: {str(e)}")
            return None

    def create_scan_record(self, system_id, file_path, scan_date, confidence='medium'):
        """יצירת רשומת סריקה"""
        try:
            self.execute_non_query(
                """INSERT INTO Scans (SystemID, start_date, ScanDate, Confidance) 
                   VALUES (?, ?, ?, ?)""",
                (system_id, scan_date, scan_date, confidence)
            )
            
            # קבלת ה-ID של הסריקה החדשה
            scan_result = self.execute_query(
                "SELECT ScansID FROM Scans WHERE SystemID = ? ORDER BY ScansID DESC LIMIT 1",
                (system_id,)
            )
            
            if scan_result:
                scan_id = scan_result[0]['ScansID']
                logger.info(f"רשומת סריקה נוצרה: ID {scan_id}")
                return scan_id
                
        except Exception as e:
            logger.error(f"שגיאה ביצירת רשומת סריקה: {str(e)}")
            return None

    def get_vulnerabilities_by_scan(self, scan_id):
        """שליפת חולשות לפי סריקה"""
        try:
            results = self.execute_query("""
                SELECT 
                    v.VulnerabilityID as id,
                    v.Description as description,
                    v.[References],
                    v.CVSS,
                    v.CVE,
                    COALESCE(v.Severity, 'Low') as severity,
                    CASE 
                        WHEN v.Description LIKE '%header%missing%' THEN 'Missing Security Header'
                        WHEN v.Description LIKE '%x-powered-by%' THEN 'Information Disclosure'
                        WHEN v.Description LIKE '%access-control-allow-origin%' THEN 'CORS Misconfiguration'
                        ELSE 'Security Issue'
                    END as vulnerability_type,
                    COALESCE(v.[References], v.Description, 'בדוק את התיאור החולשה') as recommendations,
                    COALESCE(v.Status, 'בטיפול') as status,
                    sc.ScanDate as scan_date,
                    sc.ScansID as scan_id
                FROM Vulnerabilities v
                JOIN Scans sc ON v.ScanID = sc.ScansID
                WHERE v.ScanID = ?
                ORDER BY v.VulnerabilityID DESC
            """, (scan_id,))
            
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for vuln in results:
                    if vuln.get('scan_date') and isinstance(vuln['scan_date'], datetime):
                        vuln['scan_date'] = vuln['scan_date'].isoformat()
            
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת חולשות: {str(e)}")
            return None

    def get_vulnerabilities_by_system(self, system_id):
        """שליפת חולשות לפי מערכת - רק מסריקה אחרונה"""
        try:
            results = self.execute_query("""
                WITH LatestScan AS (
                    SELECT ScansID, ScanDate
                    FROM Scans
                    WHERE SystemID = ? AND Status = 'הצליח'
                    ORDER BY ScansID DESC
                    LIMIT 1
                )
                SELECT 
                    v.VulnerabilityID as id,
                    v.Description as description,
                    v.[References],
                    v.CVSS,
                    v.CVE,
                    CASE 
                        WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                        ELSE v.Severity 
                    END as severity,
                    CASE 
                        WHEN v.Description LIKE '%header%missing%' THEN 'Missing Security Header'
                        WHEN v.Description LIKE '%x-powered-by%' THEN 'Information Disclosure'
                        WHEN v.Description LIKE '%access-control-allow-origin%' THEN 'CORS Misconfiguration'
                        ELSE 'Security Issue'
                    END as vulnerability_type,
                    COALESCE(v.[References], v.Description, 'בדוק את התיאור החולשה') as recommendations,
                    ls.ScanDate as scan_date,
                    ls.ScansID as scan_id,
                    COALESCE(v.Status, 'בטיפול') as status
                FROM Vulnerabilities v
                JOIN LatestScan ls ON v.ScanID = ls.ScansID
                ORDER BY v.VulnerabilityID DESC
            """, (system_id,))
            
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for vuln in results:
                    if vuln.get('scan_date') and isinstance(vuln['scan_date'], datetime):
                        vuln['scan_date'] = vuln['scan_date'].isoformat()
            
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת חולשות מערכת: {str(e)}")
            return None

    def update_vulnerability_status(self, vuln_id, status):
        """עדכון סטטוס חולשה"""
        try:
            # תמיכה בכל הסטטוסים
            valid_statuses = ['בטיפול', 'טופל', 'התעלם', 'סגור']
            if status not in valid_statuses:
                logger.warning(f"סטטוס לא חוקי: {status}")
                return False
            
            success = self.execute_non_query(
                "UPDATE Vulnerabilities SET Status = ? WHERE VulnerabilityID = ?",
                (status, vuln_id)
            )
            
            if success:
                logger.info(f"סטטוס חולשה {vuln_id} עודכן ל-{status}")
            return success
        except Exception as e:
            logger.error(f"שגיאה בעדכון סטטוס חולשה: {str(e)}")
            return False

    def get_vulnerability_status_stats(self, user_id=None, user_type_id=None):
        """קבלת סטטיסטיקות סטטוס חולשות - רק מסריקה אחרונה
        כולל Cache לשיפור ביצועים"""
        try:
            # בדיקת Cache
            cache_key = f"vuln_status_stats_{user_id}_{user_type_id}"
            cached_data = self._get_cached(cache_key)
            if cached_data:
                return cached_data
            
            # אם המשתמש הוא מנהל (user_type_id = 1), מציג את כל החולשות מסריקה אחרונה
            if user_type_id == 1:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    )
                    SELECT 
                        COALESCE(v.Status, 'בטיפול') as status,
                        COUNT(*) as count
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                    GROUP BY COALESCE(v.Status, 'בטיפול')
                """)
            elif user_id:
                # משתמש רגיל - רק חולשות של מערכות שהוא מורשה אליהן מסריקה אחרונה
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT sys.SystemID, MAX(s.ScansID) as LatestScanID
                        FROM Systems sys
                        JOIN SystemsUsers su ON sys.SystemID = su.SystemID
                        JOIN Scans s ON sys.SystemID = s.SystemID
                        WHERE su.UserID = ? AND s.Status = 'הצליח'
                        GROUP BY sys.SystemID
                    )
                    SELECT 
                        COALESCE(v.Status, 'בטיפול') as status,
                        COUNT(*) as count
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                    GROUP BY COALESCE(v.Status, 'בטיפול')
                """, (user_id,))
            else:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    )
                    SELECT 
                        COALESCE(v.Status, 'בטיפול') as status,
                        COUNT(*) as count
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                    GROUP BY COALESCE(v.Status, 'בטיפול')
                """)
            
            # המרה למילון - כולל כל 4 הסטטוסים
            stats = {'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0}
            if results:
                for row in results:
                    status = row.get('status', 'בטיפול')
                    count = row.get('count', 0)
                    stats[status] = count  # מעדכן את הספירה לכל סטטוס
            
            # שמירה ב-Cache
            self._set_cache(cache_key, stats)
            
            return stats
        except Exception as e:
            logger.error(f"שגיאה בשליפת סטטיסטיקות סטטוס: {str(e)}")
            return {'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0}

    def ensure_vulnerability_status_column(self):
        """וידוא שעמודת Status קיימת בטבלת Vulnerabilities"""
        try:
            cols = self._sqlite_columns("Vulnerabilities")
            if not cols:
                return False
            if "Status" not in cols:
                logger.info("מוסיף עמודת Status לטבלת Vulnerabilities...")
                self.execute_non_query(
                    "ALTER TABLE Vulnerabilities ADD COLUMN Status TEXT DEFAULT 'בטיפול'"
                )
            return True
        except Exception as e:
            logger.error("שגיאה בוידוא עמודת Status: %s", str(e))
            return False

    def ensure_scan_source_column(self):
        """וידוא שעמודת ScanSource קיימת בטבלת Scans"""
        try:
            cols = self._sqlite_columns("Scans")
            if not cols:
                return False
            if "ScanSource" not in cols:
                logger.info("מוסיף עמודת ScanSource לטבלת Scans...")
                self.execute_non_query(
                    "ALTER TABLE Scans ADD COLUMN ScanSource TEXT DEFAULT 'Nikto'"
                )
            return True
        except Exception as e:
            logger.error("שגיאה בוידוא עמודת ScanSource: %s", str(e))
            return False

    def _test_connection_internal(self):
        """בדיקת חיבור פנימית (ללא lock)"""
        cursor = None
        try:
            if self.connection:
                cursor = self.connection.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()  # וידוא שהשאילתה התבצעה בהצלחה
                return True
        except:
            return False
        finally:
            if cursor:
                try:
                    cursor.close()
                except:
                    pass

    def test_connection(self):
        """בדיקת חיבור למסד הנתונים"""
        with self._lock:
            return self._test_connection_internal()

    # פונקציות אימות משתמשים
    def set_password(self, password):
        """יוצר hash עבור סיסמה"""
        return generate_password_hash(password)

    def check_password(self, hashed_password, password):
        """בודק hash של סיסמה"""
        return check_password_hash(hashed_password, password)
        
    def authenticate_user(self, username, password):
        """אימות משתמש לפי שם משתמש וסיסמה"""
        try:
            # בדיקה אם טבלת Users קיימת, אם לא - ניצור אותה
            self.ensure_users_table_exists()
            
            user_data = self.execute_query("""
                SELECT UserID, UserName, Password, UserTypeID, IsActive, Email, FullName
                FROM Users 
                WHERE UserName = ? AND IsActive = 1
            """, (username,))
            
            if not user_data:
                logger.warning(f"משתמש לא נמצא: {username}")
                return None
            
            user = user_data[0]
            
            # בדיקת סיסמה מוצפנת
            if self.check_password(user['Password'], password):
                logger.info(f"משתמש התחבר בהצלחה: {username}")
                return {
                    'user_id': user['UserID'],
                    'username': user['UserName'],
                    'user_type_id': user['UserTypeID'],
                    'email': user['Email'],
                    'full_name': user['FullName']
                }
            else:
                logger.warning(f"סיסמה שגויה למשתמש: {username}")
                return None
                
        except Exception as e:
            logger.error(f"שגיאה באימות משתמש: {str(e)}")
            return None

    def ensure_users_table_exists(self):
        """וידוא שטבלת Users קיימת והרחבות עמודות ישנות (SQLite)."""
        try:
            existing_columns = self._sqlite_columns("Users")
            if not existing_columns:
                logger.error("טבלת Users לא קיימת — הרץ sql/sqlite/schema.sql")
                return
            required_columns = {
                "Password": "ALTER TABLE Users ADD COLUMN Password TEXT",
                "Email": "ALTER TABLE Users ADD COLUMN Email TEXT",
                "FullName": "ALTER TABLE Users ADD COLUMN FullName TEXT",
                "UserTypeID": "ALTER TABLE Users ADD COLUMN UserTypeID INTEGER NOT NULL DEFAULT 1",
                "IsActive": "ALTER TABLE Users ADD COLUMN IsActive INTEGER NOT NULL DEFAULT 1",
                "CreatedDate": "ALTER TABLE Users ADD COLUMN CreatedDate TEXT DEFAULT (datetime('now','localtime'))",
                "LastLoginDate": "ALTER TABLE Users ADD COLUMN LastLoginDate TEXT",
            }
            for col, alter_statement in required_columns.items():
                if col not in existing_columns:
                    logger.info("מוסיף עמודה חסרה לתאימות: %s", col)
                    self.execute_non_query(alter_statement)
        except Exception as e:
            logger.error("שגיאה בבדיקת טבלת Users: %s", str(e))

    def update_last_login(self, user_id):
        """עדכון זמן התחברות אחרון"""
        try:
            self.execute_non_query("""
                UPDATE Users 
                SET LastLoginDate = datetime('now','localtime') 
                WHERE UserID = ?
            """, (user_id,))
        except Exception as e:
            logger.error(f"שגיאה בעדכון זמן התחברות: {str(e)}")

    def generate_reset_token(self):
        """יצירת טוקן איפוס אקראי"""
        return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))

    def create_password_reset_token(self, email):
        """יצירת טוקן איפוס סיסמא למשתמש לפי אימייל"""
        try:
            # בדיקה אם המשתמש קיים
            user_data = self.execute_query("""
                SELECT UserID, UserName, Email, FullName
                FROM Users 
                WHERE Email = ? AND IsActive = 1
            """, (email,))
            
            if not user_data:
                logger.warning(f"לא נמצא משתמש עם אימייל: {email}")
                return None
            
            user = user_data[0]
            
            # יצירת טוקן חדש
            reset_token = self.generate_reset_token()
            expiry_time = datetime.now() + timedelta(hours=24)  # תוקף ל-24 שעות
            
            # וידוא שטבלת איפוס סיסמאות קיימת
            self.ensure_password_reset_table_exists()
            
            # מחיקת טוקנים ישנים למשתמש זה
            self.execute_non_query("""
                DELETE FROM PasswordResets 
                WHERE UserID = ?
            """, (user['UserID'],))
            
            # הוספת טוקן חדש
            self.execute_non_query("""
                INSERT INTO PasswordResets (UserID, ResetToken, ExpiryDate, IsUsed)
                VALUES (?, ?, ?, 0)
            """, (user['UserID'], reset_token, expiry_time))
            
            logger.info(f"נוצר טוקן איפוס סיסמא למשתמש: {user['UserName']}")
            
            return {
                'reset_token': reset_token,
                'user_id': user['UserID'],
                'username': user['UserName'],
                'email': user['Email'],
                'full_name': user['FullName']
            }
            
        except Exception as e:
            logger.error(f"שגיאה ביצירת טוקן איפוס סיסמא: {str(e)}")
            return None

    def validate_reset_token(self, reset_token):
        """אימות טוקן איפוס סיסמא"""
        try:
            token_data = self.execute_query("""
                SELECT pr.UserID, pr.ExpiryDate, pr.IsUsed, u.UserName, u.Email
                FROM PasswordResets pr
                JOIN Users u ON pr.UserID = u.UserID
                WHERE pr.ResetToken = ? AND u.IsActive = 1
            """, (reset_token,))
            
            if not token_data:
                logger.warning(f"טוקן איפוס לא נמצא: {reset_token}")
                return None
            
            token = token_data[0]
            
            # בדיקה אם הטוקן כבר נוצל
            if token['IsUsed']:
                logger.warning(f"טוקן איפוס כבר נוצל: {reset_token}")
                return None
            
            exp = token["ExpiryDate"]
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                except ValueError:
                    exp = datetime.strptime(exp[:19], "%Y-%m-%d %H:%M:%S")
            if datetime.now() > exp:
                logger.warning(f"טוקן איפוס פג תוקף: {reset_token}")
                return None
            
            return {
                'user_id': token['UserID'],
                'username': token['UserName'],
                'email': token['Email']
            }
            
        except Exception as e:
            logger.error(f"שגיאה באימות טוקן איפוס: {str(e)}")
            return None

    def reset_password_with_token(self, reset_token, new_password):
        """איפוס סיסמא באמצעות טוקן"""
        try:
            # אימות הטוקן
            token_info = self.validate_reset_token(reset_token)
            if not token_info:
                return False
            
            # הצפנת הסיסמה החדשה
            hashed_password = self.set_password(new_password)
            
            # עדכון הסיסמה
            self.execute_non_query("""
                UPDATE Users 
                SET Password = ?
                WHERE UserID = ?
            """, (hashed_password, token_info['user_id']))
            
            # סימון הטוקן כמנוצל
            self.execute_non_query("""
                UPDATE PasswordResets 
                SET IsUsed = 1, UsedDate = datetime('now','localtime')
                WHERE ResetToken = ?
            """, (reset_token,))
            
            logger.info(f"סיסמא אופסה בהצלחה למשתמש: {token_info['username']}")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה באיפוס סיסמא: {str(e)}")
            return False

    def ensure_password_reset_table_exists(self):
        """וידוא שטבלת איפוס סיסמאות קיימת"""
        try:
            table_check = self.execute_query(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='PasswordResets'"
            )
            if not table_check:
                logger.info("יוצר טבלת PasswordResets...")
                self.execute_non_query("""
                    CREATE TABLE PasswordResets (
                        ResetID INTEGER PRIMARY KEY AUTOINCREMENT,
                        UserID INTEGER NOT NULL REFERENCES Users(UserID),
                        ResetToken TEXT NOT NULL UNIQUE,
                        ExpiryDate TEXT NOT NULL,
                        IsUsed INTEGER NOT NULL DEFAULT 0,
                        CreatedDate TEXT DEFAULT (datetime('now','localtime')),
                        UsedDate TEXT
                    )
                """)
                self.execute_non_query(
                    "CREATE INDEX IF NOT EXISTS IX_PasswordResets_Token ON PasswordResets(ResetToken)"
                )
        except Exception as e:
            logger.error("שגיאה ביצירת טבלת PasswordResets: %s", str(e))

    def cleanup_expired_reset_tokens(self):
        """ניקוי טוקנים שפג תוקפם"""
        try:
            self.execute_non_query("""
                DELETE FROM PasswordResets 
                WHERE datetime(ExpiryDate) < datetime('now','localtime')
            """)
            logger.info("טוקני איפוס שפג תוקפם נמחקו")
        except Exception as e:
            logger.error(f"שגיאה בניקוי טוקני איפוס: {str(e)}")

    # פונקציות עבודה עם סריקות
    def get_system_url(self, system_id):
        """שליפת URL של מערכת לפי SystemID"""
        try:
            result = self.execute_query("""
                SELECT URL, SystemName, IPAddress, Port
                FROM Systems 
                WHERE SystemID = ?
            """, (system_id,))
            
            if result and len(result) > 0:
                return result[0]
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת URL מערכת {system_id}: {str(e)}")
            return None
    
    def create_scan_with_status(self, system_id, status='pending', scan_source='Nikto'):
        """יצירת רשומת סריקה עם סטטוס ומקור"""
        try:
            logger.info(f"=== Creating scan record ===")
            logger.info(f"SystemID: {system_id}, Status: {status}, ScanSource: {scan_source}")
            
            # המרת סטטוס לעברית
            # Database constraint allows: 'נכשל' (failed), 'הצליח' (completed), 'מתחיל' (starting)
            if status == 'completed':
                hebrew_status = 'הצליח'
            elif status == 'failed':
                hebrew_status = 'נכשל'
            elif status == 'pending' or status == 'starting':
                # Use 'מתחיל' (starting) for pending/starting scans
                hebrew_status = 'מתחיל'
                logger.info(f"Using 'מתחיל' (starting) as initial status for {status} scan")
            else:
                logger.warning(f"Unknown status '{status}', defaulting to 'מתחיל'")
                hebrew_status = 'מתחיל'
            
            logger.info(f"Converted status '{status}' to Hebrew: '{hebrew_status}'")
            
            # בדיקה שהמערכת קיימת לפני יצירת סריקה
            system_check = self.execute_query("""
                SELECT SystemID, SystemName 
                FROM Systems 
                WHERE SystemID = ?
            """, (system_id,))
            
            if not system_check:
                logger.error(f"System {system_id} does not exist in database")
                return None
            
            logger.info(f"System exists: {system_check[0]}")
            
            # ביצוע INSERT - שימוש בזמן ישראל במקום GETDATE() של SQL Server
            israel_time = get_israel_time()
            logger.info(f"Executing INSERT INTO Scans with Israel time: {israel_time}")
            insert_success = self.execute_non_query("""
                INSERT INTO Scans (SystemID, ScanDate, Status, ScanSource)
                VALUES (?, ?, ?, ?)
            """, (system_id, israel_time, hebrew_status, scan_source))
            
            if not insert_success:
                logger.error("INSERT INTO Scans failed - execute_non_query returned False")
                return None
            
            logger.info("INSERT INTO Scans succeeded, now retrieving scan ID...")
            
            # קבלת ה-ID של הסריקה החדשה
            scan_result = self.execute_query("""
                SELECT ScansID 
                FROM Scans 
                WHERE SystemID = ? 
                ORDER BY ScansID DESC
                LIMIT 1
            """, (system_id,))
            
            logger.info(f"Query for new scan ID returned: {scan_result}")
            
            if scan_result and len(scan_result) > 0:
                scan_id = scan_result[0]['ScansID']
                logger.info(f"✓ רשומת סריקה נוצרה: ID {scan_id}, Status: {hebrew_status}")
                return scan_id
            else:
                logger.error("No scan record found after INSERT - possible commit issue or constraint violation")
                # Try to see what's in the database
                all_scans = self.execute_query("""
                    SELECT ScansID, SystemID, Status, ScanDate
                    FROM Scans 
                    WHERE SystemID = ?
                    ORDER BY ScansID DESC
                    LIMIT 5
                """, (system_id,))
                logger.error(f"Recent scans for SystemID {system_id}: {all_scans}")
                return None
                
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            logger.error(f"=== Exception in create_scan_with_status ===")
            logger.error(f"Type: {error_type}, Message: {error_message}")
            logger.error(f"SystemID: {system_id}, Status: {status}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def update_scan_status(self, scan_id, status, start_date=None, end_date=None):
        """עדכון סטטוס סריקה"""
        try:
            # המרת סטטוס לעברית
            # Database constraint allows: 'נכשל' (failed), 'הצליח' (completed), 'מתחיל' (starting)
            if status == 'completed':
                hebrew_status = 'הצליח'
            elif status == 'failed':
                hebrew_status = 'נכשל'
            elif status == 'running' or status == 'pending' or status == 'starting':
                # Use 'מתחיל' (starting) for running/pending/starting scans
                hebrew_status = 'מתחיל'
                logger.info(f"Using 'מתחיל' (starting) for {status} status")
            else:
                logger.warning(f"Unknown status '{status}', defaulting to 'מתחיל'")
                hebrew_status = 'מתחיל'
            
            if start_date and end_date:
                self.execute_non_query("""
                    UPDATE Scans 
                    SET Status = ?, start_date = ?, End_date = ?, ScanDate = ?
                    WHERE ScansID = ?
                """, (hebrew_status, start_date, end_date, start_date, scan_id))
            elif start_date:
                self.execute_non_query("""
                    UPDATE Scans 
                    SET Status = ?, start_date = ?, ScanDate = ?
                    WHERE ScansID = ?
                """, (hebrew_status, start_date, start_date, scan_id))
            else:
                self.execute_non_query("""
                    UPDATE Scans 
                    SET Status = ?
                    WHERE ScansID = ?
                """, (hebrew_status, scan_id))
            
            logger.info(f"עדכון סטטוס סריקה {scan_id} ל-{hebrew_status}")
            return True
        except Exception as e:
            logger.error(f"שגיאה בעדכון סטטוס סריקה: {str(e)}")
            return False
    
    def get_scan_status(self, scan_id):
        """שליפת סטטוס סריקה נוכחי"""
        try:
            result = self.execute_query("""
                SELECT 
                    sc.ScansID,
                    sc.Status,
                    sc.start_date,
                    sc.End_date,
                    s.SystemName,
                    s.URL
                FROM Scans sc
                JOIN Systems s ON sc.SystemID = s.SystemID
                WHERE sc.ScansID = ?
            """, (scan_id,))
            
            if result and len(result) > 0:
                return result[0]
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת סטטוס סריקה {scan_id}: {str(e)}")
            return None
    
    def get_all_scans(self, user_id=None, user_type_id=None):
        """שליפת סריקות - מסוננות לפי הרשאות משתמש
        אופטימיזציה: החלפת 5 subqueries ב-JOIN עם GROUP BY לשיפור ביצועים"""
        try:
            # System Manager (2) רואה רק סריקות של מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                results = self.execute_query("""
                    SELECT 
                        sc.ScansID as id,
                        sc.SystemID as system_id,
                        s.SystemName as system_name,
                        s.Port as port,
                        sc.ScanDate as created_at,
                        sc.Status as scan_status,
                        sc.Duration as scan_duration_seconds,
                        COALESCE(sc.ScanSource, 'Nikto') as scan_source,
                        COUNT(v.VulnerabilityID) as total_vulnerabilities,
                        SUM(CASE WHEN v.Severity = 'Critical' THEN 1 ELSE 0 END) as critical_count,
                        SUM(CASE WHEN v.Severity = 'High' THEN 1 ELSE 0 END) as high_count,
                        SUM(CASE WHEN v.Severity = 'Medium' THEN 1 ELSE 0 END) as medium_count,
                        SUM(CASE WHEN v.VulnerabilityID IS NOT NULL AND (v.Severity = 'Low' OR v.Severity IS NULL OR v.Severity = '') THEN 1 ELSE 0 END) as low_count
                    FROM Scans sc
                    JOIN Systems s ON sc.SystemID = s.SystemID
                    INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID
                    LEFT JOIN Vulnerabilities v ON sc.ScansID = v.ScanID
                    WHERE su.UserID = ?
                    GROUP BY sc.ScansID, sc.SystemID, s.SystemName, s.Port, sc.ScanDate, 
                             sc.Status, sc.Duration, sc.ScanSource
                    ORDER BY sc.ScanDate DESC
                """, (user_id,))
            else:
                results = self.execute_query("""
                    SELECT 
                        sc.ScansID as id,
                        sc.SystemID as system_id,
                        s.SystemName as system_name,
                        s.Port as port,
                        sc.ScanDate as created_at,
                        sc.Status as scan_status,
                        sc.Duration as scan_duration_seconds,
                        COALESCE(sc.ScanSource, 'Nikto') as scan_source,
                        COUNT(v.VulnerabilityID) as total_vulnerabilities,
                        SUM(CASE WHEN v.Severity = 'Critical' THEN 1 ELSE 0 END) as critical_count,
                        SUM(CASE WHEN v.Severity = 'High' THEN 1 ELSE 0 END) as high_count,
                        SUM(CASE WHEN v.Severity = 'Medium' THEN 1 ELSE 0 END) as medium_count,
                        SUM(CASE WHEN v.VulnerabilityID IS NOT NULL AND (v.Severity = 'Low' OR v.Severity IS NULL OR v.Severity = '') THEN 1 ELSE 0 END) as low_count
                    FROM Scans sc
                    JOIN Systems s ON sc.SystemID = s.SystemID
                    LEFT JOIN Vulnerabilities v ON sc.ScansID = v.ScanID
                    GROUP BY sc.ScansID, sc.SystemID, s.SystemName, s.Port, sc.ScanDate, 
                             sc.Status, sc.Duration, sc.ScanSource
                    ORDER BY sc.ScanDate DESC
                """)
            
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for scan in results:
                    try:
                        if scan.get('created_at'):
                            if isinstance(scan['created_at'], datetime):
                                scan['created_at'] = scan['created_at'].isoformat()
                            elif hasattr(scan['created_at'], 'isoformat'):
                                scan['created_at'] = scan['created_at'].isoformat()
                    except Exception as e:
                        logger.warning(f"Error converting created_at for scan {scan.get('id')}: {str(e)}")
                        scan['created_at'] = None
            
            return results if results is not None else []
        except Exception as e:
            logger.error(f"שגיאה בשליפת סריקות: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def get_all_vulnerabilities(self, user_id=None, user_type_id=None):
        """שליפת חולשות - מסוננות לפי הרשאות משתמש - רק מסריקה אחרונה של כל מערכת"""
        try:
            # System Manager (2) רואה רק חולשות של מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT 
                            sys.SystemID,
                            MAX(sc.ScansID) as LatestScanID
                        FROM Systems sys
                        INNER JOIN SystemsUsers su ON sys.SystemID = su.SystemID
                        JOIN Scans sc ON sys.SystemID = sc.SystemID
                        WHERE su.UserID = ? AND sc.Status = 'הצליח'
                        GROUP BY sys.SystemID
                    )
                    SELECT 
                        v.VulnerabilityID as id,
                        v.Description as description,
                        v.[References] as [references],
                        v.CVSS,
                        v.CVE,
                        CASE 
                            WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                            ELSE v.Severity 
                        END as severity,
                        sys.SystemName as system_name,
                        sys.SystemID as system_id,
                        sc.ScanDate as scan_date,
                        sc.ScansID as scan_id,
                        CASE 
                            WHEN v.Description LIKE '%header%missing%' THEN 'Missing Security Header'
                            WHEN v.Description LIKE '%x-powered-by%' THEN 'Information Disclosure'
                            WHEN v.Description LIKE '%access-control-allow-origin%' THEN 'CORS Misconfiguration'
                            ELSE 'Security Issue'
                        END as vulnerability_type,
                        COALESCE(v.[References], v.Description, 'בדוק את התיאור החולשה') as recommendations
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                    JOIN Scans sc ON v.ScanID = sc.ScansID
                    JOIN Systems sys ON sc.SystemID = sys.SystemID
                    ORDER BY sc.ScanDate DESC, v.VulnerabilityID DESC
                """, (user_id,))
            else:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT 
                            sys.SystemID,
                            MAX(sc.ScansID) as LatestScanID
                        FROM Systems sys
                        JOIN Scans sc ON sys.SystemID = sc.SystemID
                        WHERE sc.Status = 'הצליח'
                        GROUP BY sys.SystemID
                    )
                    SELECT 
                        v.VulnerabilityID as id,
                        v.Description as description,
                        v.[References] as [references],
                        v.CVSS,
                        v.CVE,
                        CASE 
                            WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                            ELSE v.Severity 
                        END as severity,
                        sys.SystemName as system_name,
                        sys.SystemID as system_id,
                        sc.ScanDate as scan_date,
                        sc.ScansID as scan_id,
                        CASE 
                            WHEN v.Description LIKE '%header%missing%' THEN 'Missing Security Header'
                            WHEN v.Description LIKE '%x-powered-by%' THEN 'Information Disclosure'
                            WHEN v.Description LIKE '%access-control-allow-origin%' THEN 'CORS Misconfiguration'
                            ELSE 'Security Issue'
                        END as vulnerability_type,
                        COALESCE(v.[References], v.Description, 'בדוק את התיאור החולשה') as recommendations
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                    JOIN Scans sc ON v.ScanID = sc.ScansID
                    JOIN Systems sys ON sc.SystemID = sys.SystemID
                    ORDER BY sc.ScanDate DESC, v.VulnerabilityID DESC
                """)
            
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for vuln in results:
                    try:
                        if vuln.get('scan_date'):
                            if isinstance(vuln['scan_date'], datetime):
                                vuln['scan_date'] = vuln['scan_date'].isoformat()
                            elif hasattr(vuln['scan_date'], 'isoformat'):
                                vuln['scan_date'] = vuln['scan_date'].isoformat()
                    except Exception as e:
                        logger.warning(f"Error converting scan_date for vulnerability {vuln.get('id')}: {str(e)}")
                        vuln['scan_date'] = None
            
            return results if results is not None else []
        except Exception as e:
            logger.error(f"שגיאה בשליפת חולשות: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def get_recurring_vulnerabilities(self, user_id=None, user_type_id=None, min_systems=3):
        """שליפת חולשות חוזרות - חולשות גבוהות וקריטיות שמופיעות במספר מערכות - רק מסריקה אחרונה"""
        try:
            # System Manager (2) רואה רק חולשות של מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT sys.SystemID, MAX(sc.ScansID) as LatestScanID
                        FROM Systems sys
                        INNER JOIN SystemsUsers su ON sys.SystemID = su.SystemID
                        JOIN Scans sc ON sys.SystemID = sc.SystemID
                        WHERE su.UserID = ? AND sc.Status = 'הצליח'
                        GROUP BY sys.SystemID
                    ),
                    VulnGroups AS (
                        SELECT 
                            v.Description as description,
                            CASE 
                                WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                                ELSE v.Severity 
                            END as severity,
                            MAX(v.CVSS) as cvss,
                            MAX(v.CVE) as cve,
                            COUNT(DISTINCT sys.SystemID) as system_count
                        FROM Vulnerabilities v
                        JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                        JOIN Scans sc ON v.ScanID = sc.ScansID
                        JOIN Systems sys ON sc.SystemID = sys.SystemID
                        WHERE (v.Severity = 'High' OR v.Severity = 'Critical')
                        GROUP BY v.Description, 
                            CASE 
                                WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                                ELSE v.Severity 
                            END
                        HAVING COUNT(DISTINCT sys.SystemID) >= ?
                    )
                    SELECT 
                        vg.description,
                        vg.severity,
                        vg.cvss,
                        vg.cve,
                        vg.system_count,
                        (SELECT group_concat(sn, ', ')
                         FROM (
                             SELECT DISTINCT s2.SystemName AS sn
                             FROM Vulnerabilities v2
                             JOIN LatestScans ls2 ON v2.ScanID = ls2.LatestScanID
                             JOIN Scans sc2 ON v2.ScanID = sc2.ScansID
                             JOIN Systems s2 ON sc2.SystemID = s2.SystemID
                             WHERE v2.Description = vg.description
                         ) dx
                        ) as affected_systems,
                        (SELECT group_concat(CAST(sid AS TEXT), ',')
                         FROM (
                             SELECT DISTINCT s3.SystemID AS sid
                             FROM Vulnerabilities v3
                             JOIN LatestScans ls3 ON v3.ScanID = ls3.LatestScanID
                             JOIN Scans sc3 ON v3.ScanID = sc3.ScansID
                             JOIN Systems s3 ON sc3.SystemID = s3.SystemID
                             WHERE v3.Description = vg.description
                         ) dy
                        ) as system_ids
                    FROM VulnGroups vg
                    ORDER BY 
                        CASE vg.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 ELSE 3 END,
                        vg.system_count DESC
                """, (user_id, min_systems))
            else:
                results = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    ),
                    VulnGroups AS (
                        SELECT 
                            v.Description as description,
                            CASE 
                                WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                                ELSE v.Severity 
                            END as severity,
                            MAX(v.CVSS) as cvss,
                            MAX(v.CVE) as cve,
                            COUNT(DISTINCT sys.SystemID) as system_count
                        FROM Vulnerabilities v
                        JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                        JOIN Scans sc ON v.ScanID = sc.ScansID
                        JOIN Systems sys ON sc.SystemID = sys.SystemID
                        WHERE (v.Severity = 'High' OR v.Severity = 'Critical')
                        GROUP BY v.Description, 
                            CASE 
                                WHEN v.Severity IS NULL OR v.Severity = '' THEN 'Low'
                                ELSE v.Severity 
                            END
                        HAVING COUNT(DISTINCT sys.SystemID) >= ?
                    )
                    SELECT 
                        vg.description,
                        vg.severity,
                        vg.cvss,
                        vg.cve,
                        vg.system_count,
                        (SELECT group_concat(sn, ', ')
                         FROM (
                             SELECT DISTINCT s2.SystemName AS sn
                             FROM Vulnerabilities v2
                             JOIN LatestScans ls2 ON v2.ScanID = ls2.LatestScanID
                             JOIN Scans sc2 ON v2.ScanID = sc2.ScansID
                             JOIN Systems s2 ON sc2.SystemID = s2.SystemID
                             WHERE v2.Description = vg.description
                         ) dx
                        ) as affected_systems,
                        (SELECT group_concat(CAST(sid AS TEXT), ',')
                         FROM (
                             SELECT DISTINCT s3.SystemID AS sid
                             FROM Vulnerabilities v3
                             JOIN LatestScans ls3 ON v3.ScanID = ls3.LatestScanID
                             JOIN Scans sc3 ON v3.ScanID = sc3.ScansID
                             JOIN Systems s3 ON sc3.SystemID = s3.SystemID
                             WHERE v3.Description = vg.description
                         ) dy
                        ) as system_ids
                    FROM VulnGroups vg
                    ORDER BY 
                        CASE vg.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 ELSE 3 END,
                        vg.system_count DESC
                """, (min_systems,))
            
            return results if results is not None else []
        except Exception as e:
            logger.error(f"שגיאה בשליפת חולשות חוזרות: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def get_statistics(self, user_id=None, user_type_id=None):
        """שליפת סטטיסטיקות מערכת - מסוננות לפי הרשאות משתמש - רק מסריקה אחרונה
        כולל Cache לשיפור ביצועים"""
        try:
            # בדיקת Cache
            cache_key = f"stats_{user_id}_{user_type_id}"
            cached_data = self._get_cached(cache_key)
            if cached_data:
                return cached_data
            
            # System Manager (2) רואה רק סטטיסטיקות של מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                # סטטיסטיקות מערכות - רק מערכות שמשויכות למשתמש
                systems_stats = self.execute_query("""
                    SELECT 
                        COUNT(DISTINCT s.SystemID) as total_systems,
                        COUNT(DISTINCT s.IPAddress) as unique_ips
                    FROM Systems s
                    INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID
                    WHERE su.UserID = ?
                """, (user_id,))
                
                # סטטיסטיקות חולשות - רק חולשות מסריקה אחרונה של כל מערכת
                vulnerabilities_stats = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT s.SystemID, MAX(sc.ScansID) as LatestScanID
                        FROM Systems s
                        INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID
                        JOIN Scans sc ON s.SystemID = sc.SystemID
                        WHERE su.UserID = ? AND sc.Status = 'הצליח'
                        GROUP BY s.SystemID
                    )
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN v.Severity = 'Critical' THEN 1 ELSE 0 END) as Critical,
                        SUM(CASE WHEN v.Severity = 'High' THEN 1 ELSE 0 END) as High,
                        SUM(CASE WHEN v.Severity = 'Medium' THEN 1 ELSE 0 END) as Medium,
                        SUM(CASE WHEN v.Severity = 'Low' OR v.Severity IS NULL OR v.Severity = '' THEN 1 ELSE 0 END) as Low
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                """, (user_id,))
                
                # סטטיסטיקות סריקות - רק סריקות של מערכות שמשויכות למשתמש
                scans_stats = self.execute_query("""
                    SELECT 
                        COUNT(*) as total_scans,
                        SUM(CASE WHEN sc.Status = 'הצליח' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN sc.Status = 'נכשל' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN sc.Status = 'מתחיל' THEN 1 ELSE 0 END) as pending
                    FROM Scans sc
                    JOIN Systems s ON sc.SystemID = s.SystemID
                    INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID
                    WHERE su.UserID = ?
                """, (user_id,))
            else:
                # Admin או Super Manager - כל הסטטיסטיקות
                systems_stats = self.execute_query("""
                    SELECT 
                        COUNT(DISTINCT SystemID) as total_systems,
                        COUNT(DISTINCT IPAddress) as unique_ips
                    FROM Systems
                """)
                
                # סטטיסטיקות חולשות - רק מסריקה אחרונה של כל מערכת
                vulnerabilities_stats = self.execute_query("""
                    WITH LatestScans AS (
                        SELECT SystemID, MAX(ScansID) as LatestScanID
                        FROM Scans
                        WHERE Status = 'הצליח'
                        GROUP BY SystemID
                    )
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN v.Severity = 'Critical' THEN 1 ELSE 0 END) as Critical,
                        SUM(CASE WHEN v.Severity = 'High' THEN 1 ELSE 0 END) as High,
                        SUM(CASE WHEN v.Severity = 'Medium' THEN 1 ELSE 0 END) as Medium,
                        SUM(CASE WHEN v.Severity = 'Low' OR v.Severity IS NULL OR v.Severity = '' THEN 1 ELSE 0 END) as Low
                    FROM Vulnerabilities v
                    JOIN LatestScans ls ON v.ScanID = ls.LatestScanID
                """)
                
                scans_stats = self.execute_query("""
                    SELECT 
                        COUNT(*) as total_scans,
                        SUM(CASE WHEN Status = 'הצליח' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN Status = 'נכשל' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN Status = 'מתחיל' THEN 1 ELSE 0 END) as pending
                    FROM Scans
                """)
            
            result = {
                'systems': systems_stats[0] if systems_stats else {'total_systems': 0, 'unique_ips': 0},
                'vulnerabilities': {
                    'total': vulnerabilities_stats[0]['total'] if vulnerabilities_stats else 0,
                    'breakdown': {
                        'Critical': vulnerabilities_stats[0]['Critical'] if vulnerabilities_stats else 0,
                        'High': vulnerabilities_stats[0]['High'] if vulnerabilities_stats else 0,
                        'Medium': vulnerabilities_stats[0]['Medium'] if vulnerabilities_stats else 0,
                        'Low': vulnerabilities_stats[0]['Low'] if vulnerabilities_stats else 0
                    }
                },
                'scans': scans_stats[0] if scans_stats else {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
            }
            
            # שמירה ב-Cache
            self._set_cache(cache_key, result)
            
            return result
        except Exception as e:
            logger.error(f"שגיאה בשליפת סטטיסטיקות: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None

    # ===============================
    # פונקציות ניהול משתמשים (Admin)
    # ===============================

    def is_admin(self, user_id):
        """בדיקה אם משתמש הוא Admin (UserTypeID = 1)"""
        try:
            result = self.execute_query("""
                SELECT u.UserTypeID, ut.Description
                FROM Users u
                LEFT JOIN UsersType ut ON u.UserTypeID = ut.UserTypeID
                WHERE u.UserID = ? AND u.IsActive = 1
            """, (user_id,))
            
            if result and len(result) > 0:
                user_type = result[0]
                # Admin is UserTypeID = 1 or Description contains 'Admin'
                is_admin = user_type['UserTypeID'] == 1 or (
                    user_type.get('Description') and 'Admin' in user_type['Description']
                )
                return is_admin
            return False
        except Exception as e:
            logger.error(f"שגיאה בבדיקת הרשאת Admin: {str(e)}")
            return False

    def get_user_types(self):
        """שליפת כל סוגי ההרשאות מטבלת UsersType"""
        try:
            return self.execute_query("""
                SELECT 
                    UserTypeID as id,
                    Description as name
                FROM UsersType
                ORDER BY UserTypeID
            """)
        except Exception as e:
            logger.error(f"שגיאה בשליפת סוגי הרשאות: {str(e)}")
            return None

    def get_all_users(self):
        """שליפת כל המשתמשים עם פרטי סוג ההרשאה"""
        try:
            results = self.execute_query("""
                SELECT 
                    u.UserID as id,
                    u.UserName as username,
                    u.Email as email,
                    u.FullName as full_name,
                    u.UserTypeID as user_type_id,
                    COALESCE(ut.Description, 'לא מוגדר') as user_type_name,
                    u.IsActive as is_active,
                    u.CreatedDate as created_date,
                    u.LastLoginDate as last_login_date
                FROM Users u
                LEFT JOIN UsersType ut ON u.UserTypeID = ut.UserTypeID
                ORDER BY u.UserName
            """)
            # Convert datetime objects to ISO format strings for JSON serialization
            if results:
                for user in results:
                    if user.get('last_login_date') and isinstance(user['last_login_date'], datetime):
                        user['last_login_date'] = user['last_login_date'].isoformat()
                    elif user.get('last_login_date') is None:
                        user['last_login_date'] = None
                    if user.get('created_date') and isinstance(user['created_date'], datetime):
                        user['created_date'] = user['created_date'].isoformat()
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת משתמשים: {str(e)}")
            return None

    def get_user_by_id(self, user_id):
        """שליפת משתמש לפי ID"""
        try:
            result = self.execute_query("""
                SELECT 
                    u.UserID as id,
                    u.UserName as username,
                    u.Email as email,
                    u.FullName as full_name,
                    u.UserTypeID as user_type_id,
                    COALESCE(ut.Description, 'לא מוגדר') as user_type_name,
                    u.IsActive as is_active,
                    u.CreatedDate as created_date,
                    u.LastLoginDate as last_login_date
                FROM Users u
                LEFT JOIN UsersType ut ON u.UserTypeID = ut.UserTypeID
                WHERE u.UserID = ?
            """, (user_id,))
            
            if result and len(result) > 0:
                user = result[0]
                # Convert datetime objects to ISO format strings for JSON serialization
                if user.get('last_login_date') and isinstance(user['last_login_date'], datetime):
                    user['last_login_date'] = user['last_login_date'].isoformat()
                if user.get('created_date') and isinstance(user['created_date'], datetime):
                    user['created_date'] = user['created_date'].isoformat()
                return user
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת משתמש {user_id}: {str(e)}")
            return None

    def create_user(self, username, password, email, full_name, user_type_id):
        """יצירת משתמש חדש"""
        try:
            # בדיקה אם שם המשתמש כבר קיים
            existing = self.execute_query(
                "SELECT UserID FROM Users WHERE UserName = ?",
                (username,)
            )
            if existing:
                logger.warning(f"שם משתמש כבר קיים: {username}")
                return None
            
            # הצפנת הסיסמה
            hashed_password = self.set_password(password)
            
            # יצירת המשתמש
            success = self.execute_non_query("""
                INSERT INTO Users (UserName, Password, Email, FullName, UserTypeID, IsActive, CreatedDate)
                VALUES (?, ?, ?, ?, ?, 1, datetime('now','localtime'))
            """, (username, hashed_password, email, full_name, user_type_id))
            
            if not success:
                return None
            
            # שליפת ה-ID של המשתמש החדש
            new_user = self.execute_query(
                "SELECT UserID FROM Users WHERE UserName = ? ORDER BY UserID DESC LIMIT 1",
                (username,)
            )
            
            if new_user:
                user_id = new_user[0]['UserID']
                logger.info(f"משתמש חדש נוצר: {username} (ID: {user_id})")
                return user_id
            return None
            
        except Exception as e:
            logger.error(f"שגיאה ביצירת משתמש: {str(e)}")
            return None

    def update_user(self, user_id, username=None, email=None, full_name=None, user_type_id=None, is_active=None):
        """עדכון פרטי משתמש"""
        try:
            # בניית שאילתת UPDATE דינמית
            updates = []
            params = []
            
            if username is not None:
                # בדיקה שהשם לא תפוס על ידי משתמש אחר
                existing = self.execute_query(
                    "SELECT UserID FROM Users WHERE UserName = ? AND UserID != ?",
                    (username, user_id)
                )
                if existing:
                    logger.warning(f"שם משתמש כבר קיים: {username}")
                    return False
                updates.append("UserName = ?")
                params.append(username)
            
            if email is not None:
                updates.append("Email = ?")
                params.append(email)
            
            if full_name is not None:
                updates.append("FullName = ?")
                params.append(full_name)
            
            if user_type_id is not None:
                updates.append("UserTypeID = ?")
                params.append(user_type_id)
            
            if is_active is not None:
                updates.append("IsActive = ?")
                params.append(1 if is_active else 0)
            
            if not updates:
                return True  # אין מה לעדכן
            
            params.append(user_id)
            query = f"UPDATE Users SET {', '.join(updates)} WHERE UserID = ?"
            
            success = self.execute_non_query(query, tuple(params))
            if success:
                logger.info(f"משתמש עודכן: ID {user_id}")
            return success
            
        except Exception as e:
            logger.error(f"שגיאה בעדכון משתמש {user_id}: {str(e)}")
            return False

    def deactivate_user(self, user_id):
        """השבתת משתמש (שינוי IsActive ל-0)"""
        try:
            success = self.execute_non_query("""
                UPDATE Users 
                SET IsActive = 0 
                WHERE UserID = ?
            """, (user_id,))
            
            if success:
                logger.info(f"משתמש הושבת: ID {user_id}")
            return success
            
        except Exception as e:
            logger.error(f"שגיאה בהשבתת משתמש {user_id}: {str(e)}")
            return False

    def activate_user(self, user_id):
        """הפעלת משתמש (שינוי IsActive ל-1)"""
        try:
            success = self.execute_non_query("""
                UPDATE Users 
                SET IsActive = 1 
                WHERE UserID = ?
            """, (user_id,))
            
            if success:
                logger.info(f"משתמש הופעל: ID {user_id}")
            return success
            
        except Exception as e:
            logger.error(f"שגיאה בהפעלת משתמש {user_id}: {str(e)}")
            return False

    def admin_reset_password(self, user_id, new_password):
        """איפוס סיסמה ע"י Admin"""
        try:
            hashed_password = self.set_password(new_password)
            
            success = self.execute_non_query("""
                UPDATE Users 
                SET Password = ?
                WHERE UserID = ?
            """, (hashed_password, user_id))
            
            if success:
                logger.info(f"סיסמה אופסה על ידי Admin למשתמש: ID {user_id}")
            return success
            
        except Exception as e:
            logger.error(f"שגיאה באיפוס סיסמה למשתמש {user_id}: {str(e)}")
            return False

    def get_user_systems(self, user_id):
        """שליפת מערכות שמשתמש יכול לצפות בהן (מטבלת SystemsUsers)"""
        try:
            return self.execute_query("""
                SELECT 
                    s.SystemID as id,
                    s.SystemName as name,
                    s.IPAddress as ip_address,
                    s.URL as url
                FROM SystemsUsers su
                JOIN Systems s ON su.SystemID = s.SystemID
                WHERE su.UserID = ?
                ORDER BY s.SystemName
            """, (user_id,))
        except Exception as e:
            logger.error(f"שגיאה בשליפת מערכות משתמש {user_id}: {str(e)}")
            return None

    def user_can_access_system(self, user_id, user_type_id, system_id):
        """בודק אם משתמש יכול לגשת למערכת (להפעיל סריקה/סריקת קוד). אדמין (1) – כן; מנהל מערכת (2) – אם משויך ב-SystemsUsers; או ששם המשתמש (FullName) מופיע בשדה SystemManager של המערכת."""
        if user_type_id == 1:
            return True
        if not user_id:
            return False
        # מנהל מערכת – משויך למערכת ב-SystemsUsers
        result = self.execute_query(
            "SELECT 1 FROM SystemsUsers WHERE UserID = ? AND SystemID = ?",
            (user_id, system_id)
        )
        if result and len(result) > 0:
            return True
        # או ששם המשתמש מופיע כמנהל המערכת (SystemManager)
        user_row = self.execute_query(
            "SELECT FullName FROM Users WHERE UserID = ?", (user_id,)
        )
        if not user_row or not user_row[0].get('FullName'):
            return False
        full_name = (user_row[0]['FullName'] or '').strip()
        sys_row = self.execute_query(
            "SELECT SystemManager FROM Systems WHERE SystemID = ?", (system_id,)
        )
        if not sys_row or not sys_row[0].get('SystemManager'):
            return False
        manager_str = (sys_row[0]['SystemManager'] or '').lower()
        return full_name.lower() in manager_str

    def update_user_systems(self, user_id, system_ids):
        """עדכון קישורי משתמש-מערכות בטבלת SystemsUsers"""
        try:
            # מחיקת כל הקישורים הקיימים
            self.execute_non_query("""
                DELETE FROM SystemsUsers 
                WHERE UserID = ?
            """, (user_id,))
            
            # הוספת הקישורים החדשים
            for system_id in system_ids:
                self.execute_non_query("""
                    INSERT INTO SystemsUsers (UserID, SystemID)
                    VALUES (?, ?)
                """, (user_id, system_id))
            
            logger.info(f"עודכנו {len(system_ids)} מערכות למשתמש {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בעדכון מערכות משתמש {user_id}: {str(e)}")
            return False

    def get_all_systems_for_selection(self):
        """שליפת כל המערכות לבחירה (לטופס עריכת משתמש)"""
        try:
            return self.execute_query("""
                SELECT 
                    SystemID as id,
                    SystemName as name,
                    IPAddress as ip_address,
                    URL as url,
                    SystemManager as manager,
                    Email as email
                FROM Systems
                ORDER BY SystemName
            """)
        except Exception as e:
            logger.error(f"שגיאה בשליפת מערכות לבחירה: {str(e)}")
            return None

    # ===============================
    # מעקב סריקות PT ידניות (ManualPTTracking) - Admin
    # ===============================

    def get_manual_pt_tracking_list(self):
        """שליפת כל רשומות המעקב PT ידני עם שם מערכת מ-Systems"""
        try:
            results = self.execute_query("""
                SELECT 
                    m.Id as id,
                    m.SystemID as system_id,
                    s.SystemName as system_name,
                    m.LastPTDate as last_pt_date,
                    m.NextCheckDate as next_check_date,
                    m.SystemManagers as system_managers,
                    m.SensitivityLevel as sensitivity_level,
                    m.Status as status
                FROM ManualPTTracking m
                INNER JOIN Systems s ON m.SystemID = s.SystemID
                ORDER BY m.NextCheckDate ASC, s.SystemName
            """)
            if results:
                for row in results:
                    if row.get('last_pt_date') and hasattr(row['last_pt_date'], 'isoformat'):
                        row['last_pt_date'] = row['last_pt_date'].isoformat()[:10]
                    if row.get('next_check_date') and hasattr(row['next_check_date'], 'isoformat'):
                        row['next_check_date'] = row['next_check_date'].isoformat()[:10]
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת מעקב PT ידני: {str(e)}")
            return None

    def get_manual_pt_tracking_by_id(self, tracking_id):
        """שליפת רשומת מעקב PT ידני לפי ID"""
        try:
            result = self.execute_query("""
                SELECT 
                    m.Id as id,
                    m.SystemID as system_id,
                    s.SystemName as system_name,
                    m.LastPTDate as last_pt_date,
                    m.NextCheckDate as next_check_date,
                    m.SystemManagers as system_managers,
                    m.SensitivityLevel as sensitivity_level,
                    m.Status as status
                FROM ManualPTTracking m
                INNER JOIN Systems s ON m.SystemID = s.SystemID
                WHERE m.Id = ?
            """, (tracking_id,))
            if result and len(result) > 0:
                row = result[0]
                if row.get('last_pt_date') and hasattr(row['last_pt_date'], 'isoformat'):
                    row['last_pt_date'] = row['last_pt_date'].isoformat()[:10]
                if row.get('next_check_date') and hasattr(row['next_check_date'], 'isoformat'):
                    row['next_check_date'] = row['next_check_date'].isoformat()[:10]
                return row
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת מעקב PT {tracking_id}: {str(e)}")
            return None

    def create_manual_pt_tracking(self, system_id, last_pt_date=None, next_check_date=None,
                                  system_managers=None, sensitivity_level=None, status='הכנה'):
        """יצירת רשומת מעקב PT ידני. NextCheckDate מתעדכן אוטומטית ב-Trigger אם LastPTDate מוזן."""
        try:
            success = self.execute_non_query("""
                INSERT INTO ManualPTTracking (SystemID, LastPTDate, NextCheckDate, SystemManagers, SensitivityLevel, Status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (system_id, last_pt_date, next_check_date, system_managers or None, sensitivity_level or None, status))
            if not success:
                return None
            row = self.execute_query(
                "SELECT Id FROM ManualPTTracking WHERE SystemID = ? ORDER BY Id DESC LIMIT 1",
                (system_id,)
            )
            if row:
                return row[0]['Id']
            return None
        except Exception as e:
            logger.error(f"שגיאה ביצירת מעקב PT: {str(e)}")
            return None

    def update_manual_pt_tracking(self, tracking_id, system_id=None, last_pt_date=None, next_check_date=None,
                                   system_managers=None, sensitivity_level=None, status=None):
        """עדכון רשומת מעקב PT ידני. עדכון LastPTDate מפעיל Trigger שמעדכן NextCheckDate ל+18 חודשים."""
        try:
            updates = []
            params = []
            if system_id is not None:
                updates.append("SystemID = ?")
                params.append(system_id)
            if last_pt_date is not None:
                updates.append("LastPTDate = ?")
                params.append(last_pt_date)
            if next_check_date is not None:
                updates.append("NextCheckDate = ?")
                params.append(next_check_date)
            if system_managers is not None:
                updates.append("SystemManagers = ?")
                params.append(system_managers)
            if sensitivity_level is not None:
                updates.append("SensitivityLevel = ?")
                params.append(sensitivity_level)
            if status is not None:
                updates.append("Status = ?")
                params.append(status)
            if not updates:
                return True
            params.append(tracking_id)
            query = f"UPDATE ManualPTTracking SET {', '.join(updates)} WHERE Id = ?"
            return self.execute_non_query(query, tuple(params))
        except Exception as e:
            logger.error(f"שגיאה בעדכון מעקב PT {tracking_id}: {str(e)}")
            return False

    def delete_manual_pt_tracking(self, tracking_id):
        """מחיקת רשומת מעקב PT ידני"""
        try:
            return self.execute_non_query("DELETE FROM ManualPTTracking WHERE Id = ?", (tracking_id,))
        except Exception as e:
            logger.error(f"שגיאה במחיקת מעקב PT {tracking_id}: {str(e)}")
            return False

    def get_manual_pt_due_reminders(self):
        """שליפת רשומות שמגיע להן תזכורת - NextCheckDate בתוך 45 הימים הקרובים (מההיום)"""
        try:
            results = self.execute_query("""
                SELECT 
                    m.Id as id,
                    m.SystemID as system_id,
                    s.SystemName as system_name,
                    s.Email as system_email,
                    m.NextCheckDate as next_check_date,
                    m.SystemManagers as system_managers
                FROM ManualPTTracking m
                INNER JOIN Systems s ON m.SystemID = s.SystemID
                WHERE m.NextCheckDate IS NOT NULL
                  AND date(m.NextCheckDate) >= date('now','localtime')
                  AND date(m.NextCheckDate) <= date('now','localtime','+45 days')
                ORDER BY m.NextCheckDate
            """)
            if results:
                for row in results:
                    if row.get('next_check_date') and hasattr(row['next_check_date'], 'isoformat'):
                        row['next_check_date'] = row['next_check_date'].isoformat()[:10]
            return results
        except Exception as e:
            logger.error(f"שגיאה בשליפת תזכורות PT: {str(e)}")
            return None

    # ===============================
    # Code Review (סריקות קוד)
    # ===============================

    def get_system_repo_info(self, system_id):
        """שליפת פרטי ריפו של מערכת"""
        try:
            results = self.execute_query(
                "SELECT RepoURL, Branch FROM Systems WHERE SystemID = ?",
                (system_id,)
            )
            if results and len(results) > 0:
                return results[0]
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת פרטי ריפו למערכת {system_id}: {str(e)}")
            return None

    def create_code_review(self, system_id, repo_url, branch, user_id=None):
        """יצירת רשומת סריקת קוד חדשה בסטטוס Queued"""
        try:
            ok = self.execute_non_query(
                """INSERT INTO CodeReviews (SystemID, RepoURL, Branch, Status, InitiatedBy)
                   VALUES (?, ?, ?, 'Queued', ?)""",
                (system_id, repo_url, branch, user_id)
            )
            if not ok:
                return None
            row = self.execute_query("SELECT last_insert_rowid() AS TaskID", None)
            if row and len(row) > 0:
                task_id = row[0].get("TaskID")
                logger.info(f"Code review task {task_id} created for system {system_id}")
                return task_id
            return None
        except Exception as e:
            logger.error(f"שגיאה ביצירת code review: {str(e)}")
            return None

    def update_code_review_status(self, task_id, status, error_summary=None):
        """עדכון סטטוס סריקת קוד"""
        try:
            if status == 'Running':
                return self.execute_non_query(
                    "UPDATE CodeReviews SET Status = ?, StartedAt = datetime('now','localtime') WHERE TaskID = ?",
                    (status, task_id)
                )
            elif status in ('Succeeded', 'Failed'):
                return self.execute_non_query(
                    "UPDATE CodeReviews SET Status = ?, FinishedAt = datetime('now','localtime'), ErrorSummary = ? WHERE TaskID = ?",
                    (status, error_summary, task_id)
                )
            else:
                return self.execute_non_query(
                    "UPDATE CodeReviews SET Status = ? WHERE TaskID = ?",
                    (status, task_id)
                )
        except Exception as e:
            logger.error(f"שגיאה בעדכון סטטוס code review {task_id}: {str(e)}")
            return False

    def get_code_reviews(self, system_id=None, user_id=None, user_type_id=None):
        """שליפת רשימת סריקות קוד - אדמין רואה הכל, מנהל מערכת רואה רק סריקות של מערכות שמשויכות אליו"""
        try:
            # Admin (1) רואה את כל הסריקות; System Manager (2) רק מערכות שמשויכות אליו
            if user_type_id == 2 and user_id:
                # מנהל מערכת - רק סריקות של מערכות ב-SystemsUsers
                if system_id:
                    results = self.execute_query("""
                        SELECT cr.TaskID as task_id, cr.SystemID as system_id,
                               s.SystemName as system_name,
                               cr.RepoURL as repo_url, cr.Branch as branch,
                               cr.Status as status, cr.CreatedAt as created_at,
                               cr.StartedAt as started_at, cr.FinishedAt as finished_at,
                               cr.ErrorSummary as error_summary,
                               cr.InitiatedBy as initiated_by,
                               u.FullName as initiated_by_name,
                               CASE WHEN cr.TotalCount > 0 THEN cr.CriticalCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Critical') END as critical_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.HighCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'High') END as high_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.MediumCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Medium') END as medium_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.LowCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Low') END as low_count
                        FROM CodeReviews cr                        INNER JOIN Systems s ON cr.SystemID = s.SystemID
                        INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID AND su.UserID = ?
                        LEFT JOIN Users u ON cr.InitiatedBy = u.UserID
                        WHERE cr.SystemID = ?
                        ORDER BY cr.CreatedAt DESC
                    """, (user_id, system_id))
                else:
                    results = self.execute_query("""
                        SELECT cr.TaskID as task_id, cr.SystemID as system_id,
                               s.SystemName as system_name,
                               cr.RepoURL as repo_url, cr.Branch as branch,
                               cr.Status as status, cr.CreatedAt as created_at,
                               cr.StartedAt as started_at, cr.FinishedAt as finished_at,
                               cr.ErrorSummary as error_summary,
                               cr.InitiatedBy as initiated_by,
                               u.FullName as initiated_by_name,
                               CASE WHEN cr.TotalCount > 0 THEN cr.CriticalCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Critical') END as critical_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.HighCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'High') END as high_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.MediumCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Medium') END as medium_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.LowCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Low') END as low_count
                        FROM CodeReviews cr                        INNER JOIN Systems s ON cr.SystemID = s.SystemID
                        INNER JOIN SystemsUsers su ON s.SystemID = su.SystemID AND su.UserID = ?
                        LEFT JOIN Users u ON cr.InitiatedBy = u.UserID
                        ORDER BY cr.CreatedAt DESC
                    """, (user_id,))
            else:
                # אדמין או ללא סינון - כל הסריקות
                if system_id:
                    results = self.execute_query("""
                        SELECT cr.TaskID as task_id, cr.SystemID as system_id,
                               s.SystemName as system_name,
                               cr.RepoURL as repo_url, cr.Branch as branch,
                               cr.Status as status, cr.CreatedAt as created_at,
                               cr.StartedAt as started_at, cr.FinishedAt as finished_at,
                               cr.ErrorSummary as error_summary,
                               cr.InitiatedBy as initiated_by,
                               u.FullName as initiated_by_name,
                               CASE WHEN cr.TotalCount > 0 THEN cr.CriticalCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Critical') END as critical_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.HighCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'High') END as high_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.MediumCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Medium') END as medium_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.LowCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Low') END as low_count
                        FROM CodeReviews cr                        INNER JOIN Systems s ON cr.SystemID = s.SystemID
                        LEFT JOIN Users u ON cr.InitiatedBy = u.UserID
                        WHERE cr.SystemID = ?
                        ORDER BY cr.CreatedAt DESC
                    """, (system_id,))
                else:
                    results = self.execute_query("""
                        SELECT cr.TaskID as task_id, cr.SystemID as system_id,
                               s.SystemName as system_name,
                               cr.RepoURL as repo_url, cr.Branch as branch,
                               cr.Status as status, cr.CreatedAt as created_at,
                               cr.StartedAt as started_at, cr.FinishedAt as finished_at,
                               cr.ErrorSummary as error_summary,
                               cr.InitiatedBy as initiated_by,
                               u.FullName as initiated_by_name,
                               CASE WHEN cr.TotalCount > 0 THEN cr.CriticalCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Critical') END as critical_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.HighCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'High') END as high_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.MediumCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Medium') END as medium_count,
                               CASE WHEN cr.TotalCount > 0 THEN cr.LowCount ELSE (SELECT COUNT(*) FROM CodeReviewFindings WHERE TaskID = cr.TaskID AND Severity = 'Low') END as low_count
                        FROM CodeReviews cr                        INNER JOIN Systems s ON cr.SystemID = s.SystemID
                        LEFT JOIN Users u ON cr.InitiatedBy = u.UserID
                        ORDER BY cr.CreatedAt DESC
                    """)

            if results:
                for row in results:
                    for dt_field in ['created_at', 'started_at', 'finished_at']:
                        if row.get(dt_field) and hasattr(row[dt_field], 'isoformat'):
                            row[dt_field] = row[dt_field].isoformat()
            return results or []
        except Exception as e:
            logger.error(f"שגיאה בשליפת code reviews: {str(e)}")
            return []

    def get_code_review(self, task_id):
        """שליפת פרטי סריקת קוד בודדת"""
        try:
            results = self.execute_query("""
                SELECT cr.TaskID as task_id, cr.SystemID as system_id,
                       s.SystemName as system_name,
                       cr.RepoURL as repo_url, cr.Branch as branch,
                       cr.Status as status, cr.CreatedAt as created_at,
                       cr.StartedAt as started_at, cr.FinishedAt as finished_at,
                       cr.ErrorSummary as error_summary,
                       cr.InitiatedBy as initiated_by,
                       u.FullName as initiated_by_name,
                       (SELECT COUNT(*) FROM CodeReviews cr2                        WHERE cr2.SystemID = cr.SystemID AND cr2.TaskID <= cr.TaskID) as version
                FROM CodeReviews cr                INNER JOIN Systems s ON cr.SystemID = s.SystemID
                LEFT JOIN Users u ON cr.InitiatedBy = u.UserID
                WHERE cr.TaskID = ?
            """, (task_id,))
            if results and len(results) > 0:
                row = results[0]
                for dt_field in ['created_at', 'started_at', 'finished_at']:
                    if row.get(dt_field) and hasattr(row[dt_field], 'isoformat'):
                        row[dt_field] = row[dt_field].isoformat()
                return row
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת code review {task_id}: {str(e)}")
            return None

    def get_code_review_findings(self, task_id):
        """שליפת ממצאי סריקת קוד"""
        try:
            return self.execute_query("""
                SELECT FindingID as finding_id, TaskID as task_id,
                       FindingCode as finding_code, Title as title,
                       Description as description, Severity as severity,
                       Probability as probability, Risk as risk,
                       FilePath as file_path, LineNumber as line_number,
                       CodeSnippet as code_snippet, Recommendation as recommendation,
                       Tags as tags, Status as status
                FROM CodeReviewFindings
                WHERE TaskID = ?
                ORDER BY
                    CASE Severity
                        WHEN 'Critical' THEN 1
                        WHEN 'High' THEN 2
                        WHEN 'Medium' THEN 3
                        WHEN 'Low' THEN 4
                    END
            """, (task_id,)) or []
        except Exception as e:
            logger.error(f"שגיאה בשליפת ממצאי code review {task_id}: {str(e)}")
            return []

    def get_code_review_artifact(self, task_id, artifact_name):
        """שליפת artifact של סריקת קוד (דוח HTML, לוגים)"""
        try:
            results = self.execute_query(
                "SELECT ArtifactID as artifact_id, TaskID as task_id, ArtifactName as artifact_name, "
                "MimeType as mime_type, Content as content, CreatedAt as created_at "
                "FROM CodeReviewArtifacts WHERE TaskID = ? AND ArtifactName = ?",
                (task_id, artifact_name)
            )
            if results and len(results) > 0:
                return results[0]
            return None
        except Exception as e:
            logger.error(f"שגיאה בשליפת artifact {artifact_name} של task {task_id}: {str(e)}")
            return None

    def update_code_review_finding_status(self, finding_id, status):
        """עדכון סטטוס ממצא של סריקת קוד"""
        try:
            return self.execute_non_query(
                "UPDATE CodeReviewFindings SET Status = ? WHERE FindingID = ?",
                (status, finding_id)
            )
        except Exception as e:
            logger.error(f"שגיאה בעדכון סטטוס ממצא {finding_id}: {str(e)}")
            return False

# יצירת מופע גלובלי
db_connection = SecurityScansDatabase()