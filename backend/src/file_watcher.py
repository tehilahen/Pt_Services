"""
מעקב אחר קבצים - עוקב אחר תיקיית nikto_output ומעבד קבצי CSV חדשים
דף זה אחראי על:
- מעקב אחר תיקיית nikto_output לקבצי CSV חדשים
- עיבוד אוטומטי של קבצים חדשים שמופיעים
- העברת קבצים מעובדים לארכיון
- עיבוד קבצים קיימים בעת הפעלה
- תמיכה בפורמטים שונים של CSV
"""
import os
import time
import shutil
import logging
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from src.csv_parser import csv_parser

# הגדרת לוגים
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SecurityFileHandler(FileSystemEventHandler):
    def __init__(self, watch_folder, archive_folder):
        self.watch_folder = watch_folder
        self.archive_folder = archive_folder
        self.processed_files = set()
        
        # יצירת תיקיות אם לא קיימות
        os.makedirs(watch_folder, exist_ok=True)
        os.makedirs(archive_folder, exist_ok=True)
        
        logger.info(f"מתחיל מעקב אחר תיקייה: {watch_folder}")
    
    def on_created(self, event):
        """כאשר נוצר קובץ חדש"""
        if event.is_directory:
            return
        
        file_path = event.src_path
        file_name = os.path.basename(file_path)
        
        # בדיקה אם הקובץ הוא CSV
        if not file_name.lower().endswith('.csv'):
            logger.info(f"הקובץ אינו CSV, מתעלם: {file_name}")
            return
        
        # המתנה קצרה לוודא שהקובץ נכתב במלואו
        time.sleep(2)
        
        logger.info(f"קובץ חדש זוהה: {file_name}")
        
        # עיבוד הקובץ
        if self.process_file(file_path):
            # העברת הקובץ לארכיון
            self.archive_file(file_path)
    
    def process_file(self, file_path):
        """עיבוד קובץ CSV"""
        try:
            logger.info(f"מתחיל עיבוד: {file_path}")
            
            # זיהוי סוג הקובץ
            file_type = self.identify_file_type(file_path)
            logger.info(f"סוג קובץ מזוהה: {file_type}")
            
            # עיבוד הקובץ
            success = csv_parser.process_file(file_path)
            
            if success:
                logger.info(f"הקובץ עובד בהצלחה: {file_path}")
                self.processed_files.add(file_path)
                return True
            else:
                logger.error(f"שגיאה בעיבוד הקובץ: {file_path}")
                return False
                
        except Exception as e:
            logger.error(f"שגיאה כללית בעיבוד הקובץ {file_path}: {str(e)}")
            return False
    
    def identify_file_type(self, file_path):
        """זיהוי סוג הקובץ CSV"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                second_line = f.readline().strip()
            
            # בדיקה אם זה קובץ CVSS חדש
            if 'Nikto - v2.5.0/ (with CVSS)' in first_line:
                return 'CVSS_FORMAT'
            elif 'Hostname' in second_line and 'CVSS Score' in second_line:
                return 'CVSS_FORMAT'
            elif 'system' in second_line.lower():
                return 'LEGACY_FORMAT'
            else:
                return 'UNKNOWN_FORMAT'
                
        except Exception as e:
            logger.warning(f"לא ניתן לזהות סוג קובץ {file_path}: {str(e)}")
            return 'UNKNOWN_FORMAT'
    
    def archive_file(self, file_path):
        """העברת קובץ לארכיון"""
        try:
            file_name = os.path.basename(file_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # הוספת סוג הקובץ לשם הארכיון
            file_type = self.identify_file_type(file_path)
            type_suffix = ""
            if file_type == 'CVSS_FORMAT':
                type_suffix = "_cvss"
            elif file_type == 'LEGACY_FORMAT':
                type_suffix = "_legacy"
            
            archive_name = f"{timestamp}{type_suffix}_{file_name}"
            archive_path = os.path.join(self.archive_folder, archive_name)
            
            # העברת הקובץ לארכיון
            shutil.move(file_path, archive_path)
            logger.info(f"הקובץ הועבר לארכיון: {archive_path}")
            
        except Exception as e:
            logger.error(f"שגיאה בהעברת הקובץ לארכיון: {str(e)}")
    
    def process_existing_files(self):
        """עיבוד קבצים קיימים בתיקייה"""
        try:
            if not os.path.exists(self.watch_folder):
                logger.warning(f"תיקיית המעקב לא קיימת: {self.watch_folder}")
                return
            
            files = [f for f in os.listdir(self.watch_folder) if f.lower().endswith('.csv')]
            
            if not files:
                logger.info("לא נמצאו קבצי CSV בתיקייה")
                return
            
            logger.info(f"נמצאו {len(files)} קבצי CSV לעיבוד")
            
            for file_name in files:
                file_path = os.path.join(self.watch_folder, file_name)
                
                if file_path not in self.processed_files:
                    logger.info(f"מעבד קובץ קיים: {file_name}")
                    
                    if self.process_file(file_path):
                        self.archive_file(file_path)
                    else:
                        logger.error(f"שגיאה בעיבוד הקובץ הקיים: {file_name}")
                        
        except Exception as e:
            logger.error(f"שגיאה בעיבוד קבצים קיימים: {str(e)}")

class SecurityFileWatcher:
    def __init__(self, watch_folder="nikto_output", archive_folder="archive"):
        self.watch_folder = watch_folder
        self.archive_folder = archive_folder
        self.observer = None
        self.handler = None
    
    def start(self):
        """התחלת מעקב אחר קבצים"""
        try:
            # יצירת handler
            self.handler = SecurityFileHandler(self.watch_folder, self.archive_folder)
            
            # עיבוד קבצים קיימים
            self.handler.process_existing_files()
            
            # יצירת observer
            self.observer = Observer()
            self.observer.schedule(self.handler, self.watch_folder, recursive=False)
            self.observer.start()
            
            logger.info(f"מעקב אחר קבצים התחיל: {self.watch_folder}")
            logger.info("המערכת מוכנה לקבל קבצי CSV חדשים (CVSS ופורמט ישן)...")
            
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בהתחלת מעקב: {str(e)}")
            return False
    
    def stop(self):
        """עצירת מעקב אחר קבצים"""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info("מעקב אחר קבצים נעצר")
    
    def run_forever(self):
        """הרצת המעקב ללא הפסקה"""
        try:
            if not self.start():
                return False
            
            logger.info("המערכת פועלת... (לחץ Ctrl+C לעצירה)")
            
            while True:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("מקבל אות עצירה...")
            self.stop()
            return True
        except Exception as e:
            logger.error(f"שגיאה כללית: {str(e)}")
            self.stop()
            return False

# יצירת מופע גלובלי
file_watcher = SecurityFileWatcher()

if __name__ == "__main__":
    watcher = SecurityFileWatcher()
    watcher.run_forever() 