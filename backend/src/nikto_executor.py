#!/usr/bin/env python3
"""
מנהל ביצוע סריקות Nikto - אחראי על הפעלה ועיבוד תוצאות
דף זה אחראי על:
- הפעלת סריקות Nikto באופן אסינכרוני (באמצעות threads)
- בניית פקודות Nikto עם הפרמטרים הנכונים
- עיבוד תוצאות CSV - הוספת SystemID ו-CVSS scores
- עדכון סטטוס סריקות במסד הנתונים
- ניהול קבצי פלט ותוצאות
"""

import subprocess
import os
import logging
import threading
import csv
import tempfile
import shutil
from datetime import datetime
from urllib.parse import urlparse, urlunparse
from src.database import db_connection
from src.csv_parser import csv_parser
from src.cvss_mapper import CVSSMapper
from src.timezone_utils import get_israel_time

# הגדרת לוגים
# Configure logging with thread information
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(threadName)s] [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

class NiktoExecutor:
    """מנהל ביצוע סריקות Nikto"""
    
    def __init__(self):
        # נתיבים ברירת מחדל - עדכון לנתיב החדש בתוך Backend
        nikto_path_env = os.getenv('NIKTO_PATH', 'nikto_service/program/nikto.pl')
        # Resolve to absolute path to avoid issues with relative paths
        if os.path.isabs(nikto_path_env):
            self.nikto_path = nikto_path_env
        else:
            # If relative, resolve from current working directory
            self.nikto_path = os.path.abspath(nikto_path_env)
        
        self.perl_path = os.getenv('PERL_PATH', 'perl')
        self.scan_timeout = int(os.getenv('NIKTO_TIMEOUT', '3600'))  # 1 hour default
        
        # Initialize CVSS mapper (optional NVD API usage via environment variable)
        use_nvd = os.getenv('USE_NVD_API', 'false').lower() == 'true'
        self.cvss_mapper = CVSSMapper()
        self.use_nvd = use_nvd
        
        # Log resolved paths for debugging
        logger.info(f"Nikto path (resolved): {self.nikto_path}")
        logger.info(f"Nikto directory: {os.path.dirname(self.nikto_path)}")
        logger.info(f"Using temporary directories for scan output")
        logger.info(f"CVSS mapping enabled (NVD API: {use_nvd})")
    
    def _add_system_id_to_csv(self, csv_file_path, system_id):
        """
        הוספת עמודת SystemID לקובץ CSV שנוצר על ידי Nikto
        
        Args:
            csv_file_path: נתיב לקובץ CSV
            system_id: מזהה המערכת להוספה
        Returns:
            bool: True אם הצליח, False אחרת
        """
        try:
            logger.info(f"מוסיף SystemID {system_id} לקובץ CSV: {csv_file_path}")
            
            # יצירת קובץ זמני
            temp_file = csv_file_path + '.tmp'
            
            # בדיקה אם CVSS כבר קיים בקובץ
            has_cvss = False
            with open(csv_file_path, 'r', encoding='utf-8', newline='') as f:
                first_line = f.readline()
                if '(with CVSS)' in first_line:
                    has_cvss = True
                    logger.info("CVSS columns already exist in CSV (from Nikto plugin)")
            
            # קריאת הקובץ המקורי וכתיבת הקובץ החדש
            with open(csv_file_path, 'r', encoding='utf-8', newline='') as infile:
                with open(temp_file, 'w', encoding='utf-8', newline='') as outfile:
                    # קריאת השורה הראשונה (header של Nikto) - נדלג עליה
                    first_line = infile.readline()
                    # לא נכתוב את השורה הראשונה (נסיר את ה-header של Nikto)
                    
                    # קריאת header row
                    header_line = infile.readline().strip()
                    header_reader = csv.reader([header_line])
                    original_header = next(header_reader)
                    
                    # בדיקה אם זה header או שורת נתונים (אם יש "Hostname" זה header)
                    if 'Hostname' in original_header or 'hostname' in [h.lower() for h in original_header]:
                        # זה header - כתיבת header חדש עם SystemID בתחילתו
                        new_header = ['SystemID'] + original_header
                        writer = csv.writer(outfile)
                        writer.writerow(new_header)
                    else:
                        # זה לא header, נכתוב header חדש
                        # ננסה לזהות כמה עמודות יש
                        num_cols = len(original_header)
                        if num_cols >= 7:
                            # נראה כמו פורמט סטנדרטי
                            base_header = ['Hostname', 'IP', 'Port', 'References', 'Method', 'URI', 'Message']
                            if has_cvss:
                                base_header.extend(['CVSS Score', 'Severity', 'CVE', 'Confidence'])
                            new_header = ['SystemID'] + base_header
                        else:
                            # fallback
                            new_header = ['SystemID'] + original_header
                        writer = csv.writer(outfile)
                        writer.writerow(new_header)
                        # נכתוב גם את השורה הראשונה כנתונים
                        enhanced_row = [str(system_id)] + original_header
                        writer.writerow(enhanced_row)
                    
                    # עיבוד כל שורת נתונים והוספת SystemID
                    reader = csv.reader(infile)
                    for row in reader:
                        if len(row) == 0:
                            continue
                        # בדיקה אם זו שורת header נוספת (אם יש "Hostname" בשורה)
                        if len(row) > 0 and ('Hostname' in str(row[0]) or 'hostname' in str(row[0]).lower()):
                            # זו שורת header נוספת - נדלג עליה
                            continue
                        # הוספת SystemID בתחילת השורה
                        enhanced_row = [str(system_id)] + row
                        writer.writerow(enhanced_row)
            
            # החלפת הקובץ המקורי בקובץ החדש
            shutil.move(temp_file, csv_file_path)
            logger.info(f"SystemID נוסף בהצלחה לקובץ CSV")
            return True, has_cvss  # Return both success status and CVSS flag
            
        except Exception as e:
            logger.error(f"שגיאה בהוספת SystemID לקובץ CSV: {str(e)}")
            # ניסיון למחוק קובץ זמני אם קיים
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except:
                pass
            return False, False
    
    def _add_cvss_to_csv(self, csv_file_path):
        """
        הוספת או עדכון עמודות CVSS בקובץ CSV שכבר כולל SystemID
        
        Args:
            csv_file_path: נתיב לקובץ CSV שכבר כולל SystemID
        Returns:
            bool: True אם הצליח, False אחרת
        """
        try:
            logger.info(f"מוסיף/מעדכן CVSS בקובץ CSV: {csv_file_path}")
            
            # יצירת קובץ זמני
            temp_file = csv_file_path + '.tmp'
            
            # קריאת הקובץ המקורי וכתיבת הקובץ החדש
            with open(csv_file_path, 'r', encoding='utf-8', newline='') as infile:
                with open(temp_file, 'w', encoding='utf-8', newline='') as outfile:
                    # קריאת header עם SystemID (אין יותר header של Nikto אחרי _add_system_id_to_csv)
                    header_line = infile.readline().strip()
                    reader = csv.reader([header_line])
                    header = next(reader)
                    
                    # בדיקה אם CVSS עמודות כבר קיימות
                    has_cvss_cols = 'CVSS Score' in header
                    
                    # מציאת אינדקסים של עמודות
                    try:
                        system_id_index = header.index('SystemID')
                        message_index = header.index('Message')
                    except ValueError as e:
                        logger.error(f"לא ניתן למצוא עמודות נדרשות ב-header: {e}")
                        return False
                    
                    # כתיבת header
                    if not has_cvss_cols:
                        # הוספת CVSS עמודות
                        new_header = header + ['CVSS Score', 'Severity', 'CVE', 'Confidence']
                        cvss_start_index = len(header)
                    else:
                        # CVSS עמודות כבר קיימות - נמצא את האינדקסים שלהן
                        new_header = header
                        try:
                            cvss_start_index = header.index('CVSS Score')
                        except ValueError:
                            cvss_start_index = len(header)
                    
                    writer = csv.writer(outfile)
                    writer.writerow(new_header)
                    
                    # עיבוד כל שורה והוספת/עדכון CVSS
                    row_reader = csv.reader(infile)
                    rows_processed = 0
                    
                    for row in row_reader:
                        if len(row) == 0:
                            continue
                        
                        # דילוג על שורות header נוספות
                        if len(row) > 0 and ('Hostname' in str(row[0]) or 'hostname' in str(row[0]).lower()):
                            continue
                        
                        if len(row) > message_index:
                            message = row[message_index]
                            
                            # קבלת CVSS mapping
                            cvss_result = self.cvss_mapper.map_finding(message, use_nvd=self.use_nvd)
                            
                            # בניית שורה מעודכנת
                            if not has_cvss_cols:
                                # הוספת CVSS עמודות בסוף
                                enhanced_row = row + [
                                    str(cvss_result.cvss) if cvss_result.cvss else '',
                                    cvss_result.severity,
                                    cvss_result.cve or '',
                                    cvss_result.confidence
                                ]
                            else:
                                # עדכון CVSS עמודות קיימות
                                enhanced_row = list(row)
                                # וידוא שיש מספיק עמודות
                                while len(enhanced_row) <= cvss_start_index + 3:
                                    enhanced_row.append('')
                                # עדכון ערכי CVSS
                                enhanced_row[cvss_start_index] = str(cvss_result.cvss) if cvss_result.cvss else ''
                                enhanced_row[cvss_start_index + 1] = cvss_result.severity
                                enhanced_row[cvss_start_index + 2] = cvss_result.cve or ''
                                enhanced_row[cvss_start_index + 3] = cvss_result.confidence
                            
                            writer.writerow(enhanced_row)
                            rows_processed += 1
                        else:
                            # שורה לא מלאה
                            if not has_cvss_cols:
                                enhanced_row = row + ['', '', '', '']
                            else:
                                enhanced_row = list(row)
                                while len(enhanced_row) <= cvss_start_index + 3:
                                    enhanced_row.append('')
                            writer.writerow(enhanced_row)
            
            # החלפת הקובץ המקורי בקובץ החדש
            shutil.move(temp_file, csv_file_path)
            logger.info(f"CVSS נוסף/עודכן בהצלחה בקובץ CSV ({rows_processed} שורות עובדו)")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בהוספת CVSS לקובץ CSV: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # ניסיון למחוק קובץ זמני אם קיים
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except:
                pass
            return False
    
    def build_output_filename(self, target_url, system_id, output_dir):
        """בניית שם קובץ פלט לפי הפורמט הנדרש
        
        Args:
            target_url: URL היעד
            system_id: מזהה המערכת
            output_dir: תיקייה לשמירת הקובץ (תיקייה זמנית)
        """
        try:
            # חילוץ hostname מה-URL
            parsed = urlparse(target_url)
            hostname = parsed.hostname or parsed.path or 'localhost'
            # הסרת תווים מיוחדים
            hostname = hostname.replace(':', '_').replace('/', '_')
            
            # תאריך ושעה בפורמט DDMMYYYY-HHMM (בזמן ישראל)
            now = get_israel_time()
            date_str = now.strftime('%d%m%Y')
            time_str = now.strftime('%H%M')
            
            # בניית שם הקובץ
            filename = f"{date_str}-{time_str}-{hostname}-{system_id}.csv"
            
            # החזרת נתיב מלא (absolute path)
            filepath = os.path.join(output_dir, filename)
            # Ensure absolute path
            filepath = os.path.abspath(filepath)
            return filepath
            
        except Exception as e:
            logger.error(f"שגיאה בבניית שם קובץ: {str(e)}")
            # חלופה עם תאריך בלבד (בזמן ישראל)
            now = get_israel_time()
            filename = f"{now.strftime('%d%m%Y-%H%M')}-system-{system_id}.csv"
            return os.path.join(output_dir, filename)
    
    def build_nikto_command(self, target_url, output_file):
        """בניית פקודת Nikto"""
        try:
            # בניית הפקודה
            # Use csv_cvss format to enable CVSS integration
            command = [
                self.perl_path,
                self.nikto_path,
                '-h', target_url,
                '-Format', 'csv',  # Standard CSV format
                '-D', 'V',  # Debug flag for verbose output
                '-o', output_file,
                '-nointeractive'  # למנוע קלט מהמשתמש
            ]
            
            logger.info(f"פקודת Nikto: {' '.join(command)}")
            return command
            
        except Exception as e:
            logger.error(f"שגיאה בבניית פקודת Nikto: {str(e)}")
            return None
    
    def validate_url(self, url):
        """בדיקת תקינות URL"""
        try:
            # בדיקה בסיסית
            if not url or len(url.strip()) == 0:
                return False
            
            # בדיקה עם urlparse
            parsed = urlparse(url)
            
            # בדיקה שמרכיב בסיסי קיים
            if not parsed.scheme and not parsed.path and not parsed.netloc:
                return False
            
            # נרמול URL - הוספת http:// אם חסר scheme
            if not parsed.scheme:
                url = 'http://' + url
                parsed = urlparse(url)
            
            # בדיקה שהסכמה תומכת
            if parsed.scheme not in ['http', 'https']:
                logger.warning(f"סכמה לא נתמכת: {parsed.scheme}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בבדיקת URL: {str(e)}")
            return False
    
    def execute_nikto_scan(self, system_id, scan_id):
        """
        ביצוע סריקת Nikto באופן אסינכרוני
        
        Args:
            system_id: מזהה המערכת
            scan_id: מזהה הסריקה
        """
        # יצירת תיקייה זמנית לקבצי הסריקה
        temp_dir = tempfile.mkdtemp(prefix=f'nikto_scan_{scan_id}_')
        logger.info(f"נוצרה תיקייה זמנית לסריקה: {temp_dir}")
        
        try:
            logger.info(f"התחלת סריקת Nikto - SystemID: {system_id}, ScanID: {scan_id}")
            
            # שליפת פרטי המערכת
            system_info = db_connection.get_system_url(system_id)
            if not system_info:
                logger.error(f"לא נמצאו פרטי מערכת עבור SystemID: {system_id}")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
            
            # בניית URL עם Port
            target_url = system_info.get('URL')
            port = system_info.get('Port')
            ip_address = system_info.get('IPaddress')
            
            logger.info(f"System info - URL: {target_url}, IP: {ip_address}, Port: {port}")
            
            # אם URL חסר או ריק, ננסה לבנות אותו מ-IP ו-Port
            if not target_url or target_url.strip() == '':
                if ip_address and port:
                    # בניית URL מ-IP ו-Port
                    scheme = 'https' if port == 443 else 'http'
                    target_url = f"{scheme}://{ip_address}:{port}"
                    logger.info(f"Built URL from IP and Port: {target_url}")
                else:
                    logger.error(f"URL חסר ואין IP/Port למערכת {system_id}")
                    db_connection.update_scan_status(scan_id, 'failed')
                    return False
            else:
                # אם יש URL אבל אין Port בו, נוסיף Port אם יש Port בטבלה
                parsed = urlparse(target_url)
                if parsed.port is None and port:
                    # נוסיף Port ל-URL
                    hostname = parsed.hostname or parsed.netloc or parsed.path
                    path = parsed.path if parsed.path else '/'
                    query = ('?' + parsed.query) if parsed.query else ''
                    fragment = ('#' + parsed.fragment) if parsed.fragment else ''
                    
                    if parsed.scheme:
                        target_url = f"{parsed.scheme}://{hostname}:{port}{path}{query}{fragment}"
                    else:
                        # אם אין scheme, נוסיף http://
                        target_url = f"http://{hostname}:{port}{path}{query}{fragment}"
                    logger.info(f"Added port {port} to URL: {target_url}")
            
            # עדכון סטטוס ל-running (בזמן ישראל)
            scan_start_time = get_israel_time()
            db_connection.update_scan_status(scan_id, 'running', start_date=scan_start_time)
            
            # בדיקת תקינות URL
            if not self.validate_url(target_url):
                logger.error(f"URL לא תקין: {target_url}")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
            
            # בניית שם קובץ פלט בתיקייה הזמנית
            output_file = self.build_output_filename(target_url, system_id, temp_dir)
            
            # בניית פקודת Nikto
            command = self.build_nikto_command(target_url, output_file)
            if not command:
                logger.error("שגיאה בבניית פקודת Nikto")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
            
            # בדיקה שהנתיב של Nikto קיים
            if not os.path.exists(self.nikto_path):
                logger.error(f"נתיב Nikto לא נמצא: {self.nikto_path}")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
            
            # ביצוע הסריקה
            logger.info(f"מבצע סריקת Nikto עבור {target_url}")
            
            try:
                # Log the full command that will be executed
                logger.info(f"=== Executing Nikto Command ===")
                logger.info(f"Command: {' '.join(command)}")
                working_dir = os.path.dirname(self.nikto_path)
                logger.info(f"Working Directory: {working_dir} (exists: {os.path.exists(working_dir)})")
                logger.info(f"Nikto script exists: {os.path.exists(self.nikto_path)}")
                logger.info(f"Target URL: {target_url}")
                logger.info(f"Output File: {output_file} (absolute path)")
                logger.info(f"Output directory exists: {os.path.exists(os.path.dirname(output_file))}")
                
                # Run Nikto - capture both stdout and stderr for debugging
                # With -D V flag, we want to see the debug output to diagnose issues
                result = subprocess.run(
                    command,
                    timeout=self.scan_timeout,
                    cwd=os.path.dirname(self.nikto_path),
                    capture_output=True,  # Capture both stdout and stderr
                    text=True,  # Return as text strings
                    encoding='utf-8',
                    errors='replace'  # Replace invalid bytes with replacement character
                )
                
                # Log nikto result with full output for debugging
                logger.info(f"=== Nikto Execution Results ===")
                logger.info(f"Return Code: {result.returncode}")
                if result.stdout:
                    # Log stdout in chunks to see full output
                    stdout_lines = result.stdout.split('\n')
                    logger.info(f"STDOUT ({len(stdout_lines)} lines):")
                    for i, line in enumerate(stdout_lines[:50]):  # First 50 lines
                        if line.strip():
                            logger.info(f"  [{i+1}] {line}")
                    if len(stdout_lines) > 50:
                        logger.info(f"  ... ({len(stdout_lines) - 50} more lines)")
                if result.stderr:
                    # Log stderr in chunks to see full output
                    stderr_lines = result.stderr.split('\n')
                    logger.warning(f"STDERR ({len(stderr_lines)} lines):")
                    for i, line in enumerate(stderr_lines[:50]):  # First 50 lines
                        if line.strip():
                            logger.warning(f"  [{i+1}] {line}")
                    if len(stderr_lines) > 50:
                        logger.warning(f"  ... ({len(stderr_lines) - 50} more lines)")
                logger.info(f"==============================")
                
                # בדיקת תוצאה
                if result.returncode == 0:
                    logger.info(f"סריקת Nikto הושלמה בהצלחה: {output_file}")
                    
                    # בדיקה שהקובץ נוצר
                    if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                        logger.info(f"Output file exists, size: {os.path.getsize(output_file)} bytes")
                        
                        # הוספת SystemID לקובץ CSV
                        logger.info(f"מוסיף SystemID {system_id} לקובץ CSV")
                        result = self._add_system_id_to_csv(output_file, system_id)
                        if isinstance(result, tuple):
                            success, has_cvss = result
                        else:
                            success = result
                            has_cvss = False
                        
                        if not success:
                            logger.warning(f"שגיאה בהוספת SystemID, ממשיך בעיבוד הקובץ ללא SystemID")
                        
                        # הוספת/עדכון CVSS בקובץ CSV
                        # גם אם CVSS עמודות קיימות, ייתכן שהן ריקות ולכן נעדכן אותן
                        logger.info(f"מוסיף/מעדכן CVSS בקובץ CSV")
                        if not self._add_cvss_to_csv(output_file):
                            logger.warning(f"שגיאה בהוספת CVSS, ממשיך בעיבוד הקובץ ללא CVSS")
                        
                        # עיבוד הקובץ
                        logger.info(f"מעבד תוצאות מהקובץ: {output_file}")
                        # Pass scan_id to process_file so it can update the correct scan
                        success = csv_parser.process_file(output_file, scan_id=scan_id)
                        
                        if success:
                            # עדכון סטטוס להצליח (בזמן ישראל)
                            scan_end_time = get_israel_time()
                            db_connection.update_scan_status(
                                scan_id, 
                                'completed',
                                start_date=scan_start_time,
                                end_date=scan_end_time
                            )
                            logger.info(f"עיבוד תוצאות הושלם בהצלחה עבור ScanID: {scan_id}")
                            return True
                        else:
                            logger.error(f"שגיאה בעיבוד תוצאות עבור ScanID: {scan_id}")
                            db_connection.update_scan_status(scan_id, 'failed')
                            return False
                    else:
                        logger.warning(f"קובץ פלט לא נוצר או ריק: {output_file}")
                        if os.path.exists(output_file):
                            logger.warning(f"File exists but size is {os.path.getsize(output_file)} bytes")
                        db_connection.update_scan_status(scan_id, 'failed')
                        return False
                else:
                    logger.error(f"סריקת Nikto נכשלה עם קוד שגיאה: {result.returncode}")
                    if result.stderr:
                        logger.error(f"פלט שגיאה (full): {result.stderr}")
                    if result.stdout:
                        logger.error(f"פלט רגיל (full): {result.stdout}")
                    db_connection.update_scan_status(scan_id, 'failed')
                    return False
                    
            except subprocess.TimeoutExpired:
                logger.error(f"סריקת Nikto חרגה ממשך הזמן הקצוב ({self.scan_timeout} שניות)")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
            except Exception as e:
                logger.error(f"שגיאה בביצוע סריקת Nikto: {str(e)}")
                db_connection.update_scan_status(scan_id, 'failed')
                return False
                
        except Exception as e:
            logger.error(f"שגיאה כללית בביצוע סריקת Nikto: {str(e)}")
            db_connection.update_scan_status(scan_id, 'failed')
            return False
        finally:
            # מחיקת התיקייה הזמנית וכל תוכנה
            try:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    logger.info(f"תיקייה זמנית נמחקה: {temp_dir}")
            except Exception as cleanup_error:
                logger.warning(f"שגיאה במחיקת תיקייה זמנית {temp_dir}: {cleanup_error}")
    
    def execute_scan_async(self, system_id, scan_id):
        """
        הפעלת סריקת Nikto באופן אסינכרוני באמצעות thread
        
        Args:
            system_id: מזהה המערכת
            scan_id: מזהה הסריקה
        """
        def scan_worker():
            thread_name = threading.current_thread().name
            logger.info(f"[Thread {thread_name}] === Starting Nikto Scan Worker ===")
            logger.info(f"[Thread {thread_name}] SystemID: {system_id}, ScanID: {scan_id}")
            try:
                logger.info(f"[Thread {thread_name}] Calling execute_nikto_scan...")
                result = self.execute_nikto_scan(system_id, scan_id)
                logger.info(f"[Thread {thread_name}] execute_nikto_scan completed with result: {result}")
            except Exception as e:
                logger.error(f"[Thread {thread_name}] שגיאה ב-worker של סריקת Nikto: {str(e)}", exc_info=True)
            finally:
                logger.info(f"[Thread {thread_name}] === Nikto Scan Worker Finished ===")
        
        # הפעלת thread נפרד
        thread = threading.Thread(target=scan_worker, daemon=True, name=f"NiktoScan-{scan_id}")
        thread.start()
        logger.info(f"סריקת Nikto הופעלה ב-thread נפרד עבור ScanID: {scan_id} (Thread: {thread.name})")
        return thread

# יצירת מופע גלובלי
nikto_executor = NiktoExecutor()

