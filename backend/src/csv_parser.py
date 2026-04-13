"""
מפענח קבצי CSV - מעבד תוצאות סריקות Nikto ומכניס למסד הנתונים
דף זה אחראי על:
- קריאת קבצי CSV בפורמטים שונים (רגיל, CVSS, legacy)
- זיהוי אוטומטי של פורמט הקובץ
- עיבוד חולשות והוספה למסד הנתונים
- קישור חולשות למערכות וסריקות
- תמיכה בקבצים עם/בלי SystemID, עם/בלי CVSS scores
"""
import pandas as pd
import os
import logging
from datetime import datetime
from src.database import db_connection
from src.timezone_utils import get_israel_time
import re

# הגדרת לוגים
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CVSSCSVParser:
    def __init__(self):
        self.db = db_connection
    
    def determine_vulnerability_type(self, message, url, method):
        """קביעת סוג החולשה על בסיס ההודעה"""
        message_lower = message.lower() if message else ""
        url_lower = url.lower() if url else ""
        
        # מיפוי סוגי חולשות
        if 'sql injection' in message_lower:
            return 'SQL Injection'
        elif 'xss' in message_lower or 'cross-site scripting' in message_lower:
            return 'Cross-Site Scripting'
        elif 'header' in message_lower and 'missing' in message_lower:
            return 'Missing Security Header'
        elif 'x-powered-by' in message_lower:
            return 'Information Disclosure'
        elif 'access-control-allow-origin' in message_lower:
            return 'CORS Misconfiguration'
        elif 'content-security-policy' in message_lower:
            return 'Missing CSP Header'
        elif 'x-content-type-options' in message_lower:
            return 'Missing Content Type Options'
        elif 'strict-transport-security' in message_lower:
            return 'Missing HSTS Header'
        elif 'permissions-policy' in message_lower:
            return 'Missing Permissions Policy'
        elif 'referrer-policy' in message_lower:
            return 'Missing Referrer Policy'
        else:
            return 'Other Security Issue'
    
    def parse_csv_file(self, file_path):
        """פרסור קובץ CSV עם נתוני CVSS החדש"""
        try:
            logger.info(f"מתחיל עיבוד קובץ: {file_path}")
            
            # קריאת הקובץ
            encodings = ['utf-8', 'utf-16', 'cp1255', 'iso-8859-1', 'windows-1255']
            df = None
            
            for encoding in encodings:
                try:
                    # בדיקה אם זה קובץ CVSS החדש (מתחיל בשורת כותרת מיוחדת)
                    with open(file_path, 'r', encoding=encoding) as f:
                        first_line = f.readline().strip()
                        if 'Nikto - v2.5.0/ (with CVSS)' in first_line:
                            # קובץ CVSS חדש - דילוג על שורת הכותרת הראשונה
                            df = pd.read_csv(file_path, encoding=encoding, skiprows=1)
                        elif 'Nikto - v2.5.0/' in first_line:
                            # Standard Nikto CSV format - skip version header line
                            # The next line is the header, so skip first line and read with header
                            df = pd.read_csv(file_path, encoding=encoding, skiprows=1)
                            logger.info("Detected standard Nikto CSV format")
                        else:
                            # קובץ רגיל - ננסה לקרוא עם header
                            df = pd.read_csv(file_path, encoding=encoding)
                    
                    logger.info(f"הקובץ נקרא בהצלחה עם קידוד: {encoding}")
                    break
                except UnicodeDecodeError:
                    continue
            
            if df is None:
                logger.error("לא ניתן לקרוא את הקובץ")
                return False
            
            logger.info(f"נמצאו {len(df)} שורות בקובץ")
            logger.info(f"עמודות בקובץ: {list(df.columns)}")
            
            # וידוא שיש נתונים
            if df.empty:
                logger.warning("הקובץ ריק")
                return False
            
            # זיהוי פורמט הקובץ על בסיס העמודות
            # New format: SystemID, Hostname, IP, Port, References, Method, URI, Message, CVSS Score, Severity, CVE, Confidence
            if 'SystemID' in df.columns and 'CVSS Score' in df.columns:
                logger.info("Detected enhanced format with SystemID and CVSS")
                return self._parse_enhanced_format(df, file_path)
            elif 'Hostname' in df.columns and 'CVSS Score' in df.columns:
                # CVSS format without SystemID (legacy)
                return self._parse_cvss_format(df, file_path)
            elif 'SystemID' in df.columns and 'Hostname' in df.columns and 'Message' in df.columns:
                # Format with SystemID but without CVSS
                logger.info("Detected format with SystemID but without CVSS")
                return self._parse_standard_nikto_format(df, file_path)
            elif 'Hostname' in df.columns and 'IP' in df.columns and 'Message' in df.columns:
                # Standard Nikto CSV format (without CVSS and SystemID)
                return self._parse_standard_nikto_format(df, file_path)
            elif 'system' in df.columns:
                return self._parse_legacy_format(df, file_path)
            else:
                logger.error(f"פורמט קובץ לא מזוהה. עמודות זמינות: {list(df.columns)}")
                return False
                
        except Exception as e:
            logger.error(f"שגיאה כללית בעיבוד הקובץ: {str(e)}")
            return False
    
    def _parse_enhanced_format(self, df, file_path):
        """עיבוד קובץ בפורמט החדש עם SystemID ו-CVSS"""
        try:
            logger.info("Parsing enhanced CSV format with SystemID and CVSS")
            
            # קבלת system_id מהשורה הראשונה
            if df.empty:
                logger.error("הקובץ ריק")
                return False
            
            first_row = df.iloc[0]
            system_id = int(first_row.get('SystemID', 0)) if pd.notna(first_row.get('SystemID')) else None
            
            if not system_id:
                logger.error("SystemID לא נמצא בקובץ")
                return False
            
            logger.info(f"SystemID from CSV: {system_id}")
            
            # אם scan_id מסופק, נשתמש בו
            if hasattr(self, 'current_scan_id') and self.current_scan_id:
                scan_id = self.current_scan_id
                logger.info(f"Using provided scan_id: {scan_id}")
            else:
                # מציאת scan_id מהמערכת
                scan_result = self.db.execute_query("""
                    SELECT ScansID 
                    FROM Scans 
                    WHERE SystemID = ? 
                    ORDER BY ScansID DESC
                    LIMIT 1
                """, (system_id,))
                
                if not scan_result:
                    logger.warning("No scan record found, creating new one")
                    scan_date = get_israel_time()
                    scan_id = self.db.create_scan_record(system_id, file_path, scan_date)
                else:
                    scan_id = scan_result[0]['ScansID']
                    logger.info(f"Using existing scan record: {scan_id}")
            
            if not scan_id:
                logger.error("שגיאה ביצירת/קבלת רשומת סריקה")
                return False
            
            # עיבוד החולשות
            vulnerabilities_added = 0
            
            for index, row in df.iterrows():
                try:
                    # דילוג על שורות ריקות
                    message = str(row.get('Message', '')).strip('"')
                    if pd.isna(message) or message == '' or message == 'Message':
                        continue
                    
                    references = str(row.get('References', '')).strip('"') if pd.notna(row.get('References')) and str(row.get('References', '')).strip('"') != '' else None
                    
                    # נתוני CVSS
                    cvss_score = None
                    try:
                        cvss_val = row.get('CVSS Score', '')
                        if pd.notna(cvss_val) and str(cvss_val).strip() != '':
                            cvss_score = int(float(cvss_val))
                    except:
                        cvss_score = None
                    
                    # CVE
                    cve = str(row.get('CVE', '')).strip('"') if pd.notna(row.get('CVE')) and str(row.get('CVE', '')).strip('"') != '' else None
                    
                    # Severity
                    severity = str(row.get('Severity', 'Low')).strip('"').capitalize() if pd.notna(row.get('Severity')) else 'Low'
                    
                    # הכנסת החולשה עם כל הנתונים
                    if references and cvss_score and cve and severity:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References], CVSS, CVE, Severity) VALUES (?, ?, ?, ?, ?, ?)"
                        values = [scan_id, message, references, cvss_score, cve, severity]
                    elif references and cvss_score and severity:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References], CVSS, Severity) VALUES (?, ?, ?, ?, ?)"
                        values = [scan_id, message, references, cvss_score, severity]
                    elif cvss_score and severity:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, CVSS, Severity) VALUES (?, ?, ?, ?)"
                        values = [scan_id, message, cvss_score, severity]
                    elif severity:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, Severity) VALUES (?, ?, ?)"
                        values = [scan_id, message, severity]
                    else:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description) VALUES (?, ?)"
                        values = [scan_id, message]
                    
                    success = self.db.execute_non_query(query, values)
                    
                    if success:
                        vulnerabilities_added += 1
                        logger.debug(f"חולשה נוספה: {message[:50]}...")
                    
                except Exception as e:
                    logger.error(f"שגיאה בעיבוד שורה {index}: {str(e)}")
                    continue
            
            # עדכון סטטוס הסריקה
            try:
                self.db.execute_non_query(
                    "UPDATE Scans SET End_date = ? WHERE ScansID = ?",
                    (get_israel_time(), scan_id)
                )
            except:
                pass
            
            logger.info(f"הסתיים עיבוד הקובץ. נוספו {vulnerabilities_added} חולשות")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בעיבוד פורמט משופר: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def _parse_cvss_format(self, df, file_path):
        """עיבוד קובץ בפורמט CVSS החדש"""
        try:
            # קבלת נתוני המערכת מהשורה הראשונה
            first_row = df.iloc[0]
            hostname = str(first_row.get('Hostname', 'Unknown'))
            ip_address = str(first_row.get('IP', '0.0.0.0'))
            port = int(first_row.get('Port', 80)) if pd.notna(first_row.get('Port')) else 80
            
            # יצירת/קבלת מערכת
            system_id = self.db.get_or_create_system(hostname, ip_address, port)
            if not system_id:
                logger.error("שגיאה ביצירת/קבלת מערכת")
                return False
            
            # יצירת רשומת סריקה
            scan_date = get_israel_time()
            scan_id = self.db.create_scan_record(system_id, file_path, scan_date)
            
            if not scan_id:
                logger.error("שגיאה ביצירת רשומת סריקה")
                return False
            
            # עיבוד החולשות
            vulnerabilities_added = 0
            
            for index, row in df.iterrows():
                try:
                    # דילוג על שורות ריקות
                    if pd.isna(row.get('Message')) or str(row.get('Message')).strip() == '':
                        continue
                    
                    # קבלת נתונים מהשורה - התאמה לעמודות הקיימות
                    message = str(row.get('Message', ''))
                    references = str(row.get('References', '')) if pd.notna(row.get('References')) and str(row.get('References', '')) != '' else None
                    
                    # נתוני CVSS - המרה ל-int
                    cvss_score = None
                    try:
                        cvss_val = row.get('CVSS Score', 0)
                        if pd.notna(cvss_val) and cvss_val != '':
                            cvss_score = int(float(cvss_val))
                    except:
                        cvss_score = None
                    
                    # CVE
                    cve = str(row.get('CVE', '')) if pd.notna(row.get('CVE')) and str(row.get('CVE', '')) != '' else None
                    
                    # Severity - קבלת הערך מהקובץ
                    severity = str(row.get('Severity', 'Low')).capitalize() if pd.notna(row.get('Severity')) else 'Low'
                    
                    # הכנסת החולשה עם כל הנתונים
                    if references and cvss_score and cve and severity:
                        # כל הנתונים קיימים
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References], CVSS, CVE, Severity) VALUES (?, ?, ?, ?, ?, ?)"
                        values = [scan_id, message, references, cvss_score, cve, severity]
                    elif references and cvss_score and severity:
                        # ללא CVE
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References], CVSS, Severity) VALUES (?, ?, ?, ?, ?)"
                        values = [scan_id, message, references, cvss_score, severity]
                    elif cvss_score and severity:
                        # רק עם CVSS וחומרה
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, CVSS, Severity) VALUES (?, ?, ?, ?)"
                        values = [scan_id, message, cvss_score, severity]
                    elif severity:
                        # רק עם חומרה
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, Severity) VALUES (?, ?, ?)"
                        values = [scan_id, message, severity]
                    else:
                        # רק התיאור
                        query = "INSERT INTO Vulnerabilities (ScanID, Description) VALUES (?, ?)"
                        values = [scan_id, message]
                    
                    success = self.db.execute_non_query(query, values)
                    
                    if success:
                        vulnerabilities_added += 1
                        logger.debug(f"חולשה נוספה: {message[:50]}...")
                    
                except Exception as e:
                    logger.error(f"שגיאה בעיבוד שורה {index}: {str(e)}")
                    continue
            
            # עדכון סטטוס הסריקה (ללא total_vulnerabilities)
            try:
                self.db.execute_non_query(
                    "UPDATE Scans SET End_date = ? WHERE ScansID = ?",
                    (get_israel_time(), scan_id)
                )
            except:
                # אם יש בעיה עם עדכון Status, פשוט נתעלם
                pass
            
            logger.info(f"הסתיים עיבוד הקובץ. נוספו {vulnerabilities_added} חולשות")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בעיבוד פורמט CVSS: {str(e)}")
            return False
    
    def _parse_legacy_format(self, df, file_path):
        """עיבוד קובץ בפורמט הישן"""
        try:
            # קבלת נתוני המערכת מהשורה הראשונה
            first_row = df.iloc[0]
            system_name = str(first_row.get('system', 'Unknown System'))
            ip_address = str(first_row.get('ip address', '0.0.0.0'))
            port = int(first_row.get('port', 80)) if pd.notna(first_row.get('port')) else 80
            
            # יצירת/קבלת מערכת
            system_id = self.db.get_or_create_system(system_name, ip_address, port)
            if not system_id:
                return False
            
            # יצירת רשומת סריקה
            scan_date = get_israel_time()
            scan_id = self.db.create_scan_record(system_id, file_path, scan_date)
            
            if not scan_id:
                return False
            
            # עיבוד החולשות
            vulnerabilities_added = 0
            
            for index, row in df.iterrows():
                try:
                    if pd.isna(row.get('rrecommendations')) or str(row.get('rrecommendations')).strip() == '':
                        continue
                    
                    message = str(row.get('rrecommendations', ''))
                    references = str(row.get('references', '')) if pd.notna(row.get('references')) and str(row.get('references', '')) != '' else None
                    
                    # הכנסת החולשה עם העמודות הקיימות בלבד
                    if references:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References]) VALUES (?, ?, ?)"
                        values = [scan_id, message, references]
                    else:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description) VALUES (?, ?)"
                        values = [scan_id, message]
                    
                    success = self.db.execute_non_query(query, values)
                    
                    if success:
                        vulnerabilities_added += 1
                    
                except Exception as e:
                    logger.error(f"שגיאה בעיבוד שורה {index}: {str(e)}")
                    continue
            
            # עדכון סטטוס הסריקה
            try:
                self.db.execute_non_query(
                    "UPDATE Scans SET End_date = ? WHERE ScansId = ?",
                    (get_israel_time(), scan_id)
                )
            except:
                pass
            
            logger.info(f"הסתיים עיבוד הקובץ הישן. נוספו {vulnerabilities_added} חולשות")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בעיבוד פורמט ישן: {str(e)}")
            return False
    
    def _parse_standard_nikto_format(self, df, file_path):
        """עיבוד קובץ בפורמט Nikto סטנדרטי (ללא CVSS)"""
        try:
            logger.info("Parsing standard Nikto CSV format")
            
            # קבלת נתוני המערכת מהשורה הראשונה
            if df.empty:
                logger.error("הקובץ ריק")
                return False
            
            first_row = df.iloc[0]
            hostname = str(first_row.get('Hostname', 'Unknown')).strip('"')
            ip_address = str(first_row.get('IP', '0.0.0.0')).strip('"')
            port = int(first_row.get('Port', 80)) if pd.notna(first_row.get('Port')) and str(first_row.get('Port', '')).strip('"') != '' else 80
            
            logger.info(f"System info - Hostname: {hostname}, IP: {ip_address}, Port: {port}")
            
            # יצירת/קבלת מערכת
            system_id = self.db.get_or_create_system(hostname, ip_address, port)
            if not system_id:
                logger.error("שגיאה ביצירת/קבלת מערכת")
                return False
            
            # אם scan_id מסופק (מה-nikto_executor), נשתמש בו
            # אחרת נמצא או ניצור scan_id חדש
            if hasattr(self, 'current_scan_id') and self.current_scan_id:
                scan_id = self.current_scan_id
                logger.info(f"Using provided scan_id: {scan_id}")
                
                # וידוא שהscan שייך למערכת הנכונה
                scan_check = self.db.execute_query("""
                    SELECT ScansID, SystemID 
                    FROM Scans 
                    WHERE ScansID = ?
                """, (scan_id,))
                
                if scan_check and scan_check[0]['SystemID'] == system_id:
                    logger.info(f"Scan {scan_id} verified for SystemID {system_id}")
                else:
                    logger.warning(f"Scan {scan_id} doesn't match SystemID {system_id}, creating new scan")
                    scan_date = get_israel_time()
                    scan_id = self.db.create_scan_record(system_id, file_path, scan_date)
            else:
                # מציאת scan_id מהמערכת - נשתמש ב-scan_id האחרון שנמצא או ניצור חדש
                scan_result = self.db.execute_query("""
                    SELECT ScansID 
                    FROM Scans 
                    WHERE SystemID = ? 
                    ORDER BY ScansID DESC
                    LIMIT 1
                """, (system_id,))
                
                if not scan_result:
                    logger.warning("No scan record found, creating new one")
                    scan_date = get_israel_time()
                    scan_id = self.db.create_scan_record(system_id, file_path, scan_date)
                else:
                    scan_id = scan_result[0]['ScansID']
                    logger.info(f"Using existing scan record: {scan_id}")
            
            if not scan_id:
                logger.error("שגיאה ביצירת/קבלת רשומת סריקה")
                return False
            
            # עיבוד החולשות
            vulnerabilities_added = 0
            
            for index, row in df.iterrows():
                try:
                    # דילוג על שורות ריקות או שורות header
                    message = str(row.get('Message', '')).strip('"')
                    if pd.isna(message) or message == '' or message == 'Message':
                        continue
                    
                    hostname_val = str(row.get('Hostname', '')).strip('"')
                    ip_val = str(row.get('IP', '')).strip('"')
                    port_val = str(row.get('Port', '')).strip('"')
                    references = str(row.get('References', '')).strip('"') if pd.notna(row.get('References')) and str(row.get('References', '')).strip('"') != '' else None
                    method = str(row.get('Method', 'GET')).strip('"')
                    uri = str(row.get('URI', '/')).strip('"')
                    
                    # קביעת חומרה
                    severity = self._determine_severity_legacy(message, None)
                    
                    # הכנסת החולשה
                    if references:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, [References], Severity) VALUES (?, ?, ?, ?)"
                        values = [scan_id, message, references, severity]
                    else:
                        query = "INSERT INTO Vulnerabilities (ScanID, Description, Severity) VALUES (?, ?, ?)"
                        values = [scan_id, message, severity]
                    
                    success = self.db.execute_non_query(query, values)
                    
                    if success:
                        vulnerabilities_added += 1
                        logger.debug(f"חולשה נוספה: {message[:50]}...")
                    
                except Exception as e:
                    logger.error(f"שגיאה בעיבוד שורה {index}: {str(e)}")
                    continue
            
            # עדכון סטטוס הסריקה
            try:
                self.db.execute_non_query(
                    "UPDATE Scans SET End_date = ? WHERE ScansID = ?",
                    (get_israel_time(), scan_id)
                )
            except:
                pass
            
            logger.info(f"הסתיים עיבוד הקובץ. נוספו {vulnerabilities_added} חולשות")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בעיבוד פורמט Nikto סטנדרטי: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False
    
    def _determine_severity_legacy(self, description, vulnerability_type):
        """קביעת חומרת החולשה לפי התיאור (מהלוגיקה הישנה)"""
        description_lower = description.lower()
        
        # קריטי
        critical_keywords = ['sql injection', 'authentication bypass', 'default credentials', 'critical']
        if any(keyword in description_lower for keyword in critical_keywords):
            return 'Critical'
        
        # גבוה
        high_keywords = ['xss', 'cross-site scripting', 'information disclosure', 'directory listing', 'high']
        if any(keyword in description_lower for keyword in high_keywords):
            return 'High'
        
        # בינוני
        medium_keywords = ['missing security header', 'outdated', 'medium']
        if any(keyword in description_lower for keyword in medium_keywords):
            return 'Medium'
        
        # נמוך
        return 'Low'

    def process_file(self, file_path, scan_id=None):
        """עיבוד קובץ CSV
        
        Args:
            file_path: נתיב לקובץ CSV
            scan_id: מזהה סריקה קיים (אופציונלי) - אם לא מסופק, יווצר חדש
        """
        try:
            if not os.path.exists(file_path):
                logger.error(f"הקובץ לא נמצא: {file_path}")
                return False
            
            self.current_scan_id = scan_id  # Store for use in parsing methods
            
            if not file_path.lower().endswith('.csv'):
                logger.info(f"הקובץ אינו CSV: {file_path}")
                return False
            
            logger.info(f"מתחיל עיבוד הקובץ: {file_path}")
            success = self.parse_csv_file(file_path)
            
            if success:
                logger.info(f"הקובץ עובד בהצלחה: {file_path}")
                return True
            else:
                logger.error(f"שגיאה בעיבוד הקובץ: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"שגיאה כללית בעיבוד הקובץ {file_path}: {str(e)}")
            return False

# יצירת מופע גלובלי
csv_parser = CVSSCSVParser() 