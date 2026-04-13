"""
נקודת כניסה ראשית למערכת - מפעיל את שרת ה-API
דף זה אחראי על:
- אתחול חיבור למסד הנתונים
- הפעלת שרת Flask API
- ניהול lifecycle של המערכת

הערה: File Watcher הושבת - משתמשים בתיקיות זמניות לכל סריקה
"""
import os
import logging
import threading
from dotenv import load_dotenv
from src.api_server import app
from src.database import db_connection
# File Watcher disabled - using temp directories per scan
# from src.file_watcher import file_watcher

# טעינת משתני הסביבה
load_dotenv()

# הגדרת לוגים
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def start_api_server():
    """התחלת שרת API"""
    try:
        host = os.getenv('FLASK_HOST', '0.0.0.0')
        port = int(os.getenv('FLASK_PORT', 5000))
        debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
        
        logger.info(f"מתחיל שרת API על {host}:{port}")
        app.run(host=host, port=port, debug=debug, use_reloader=False)
    except Exception as e:
        logger.error(f"שגיאה בשרת API: {str(e)}")

def initialize_database():
    """אתחול מסד הנתונים"""
    try:
        logger.info("מתחבר למסד הנתונים...")
        if db_connection.connect():
            logger.info("חיבור למסד הנתונים הצליח")
            return True
        else:
            logger.error("שגיאה בחיבור למסד הנתונים")
            return False
    except Exception as e:
        logger.error(f"שגיאה באתחול מסד הנתונים: {str(e)}")
        return False

# File Watcher disabled - using temp directories per scan
# def start_file_watcher():
#     """התחלת מעקב אחר קבצים"""
#     try:
#         logger.info("מתחיל file watcher...")
#         file_watcher.start()
#         logger.info("File watcher פעיל ועוקב אחר תיקיית nikto_output")
#     except Exception as e:
#         logger.error(f"שגיאה בהפעלת file watcher: {str(e)}")

def main():
    """הפעלה ראשית של המערכת"""
    try:
        logger.info("מתחיל מערכת Security Scans Backend...")
        
        # אתחול מסד הנתונים
        if not initialize_database():
            logger.error("לא ניתן להתחבר למסד הנתונים - יוצא")
            return
        
        # File Watcher disabled - using temp directories per scan
        # watcher_thread = threading.Thread(target=start_file_watcher, daemon=True)
        # watcher_thread.start()
        # logger.info("File watcher thread הופעל בהצלחה")
        
        # התחלת שרת API
        start_api_server()
        
    except KeyboardInterrupt:
        logger.info("מקבל אות עצירה...")
        # file_watcher.stop()
    except Exception as e:
        logger.error(f"שגיאה כללית: {str(e)}")
        # file_watcher.stop()

if __name__ == "__main__":
    main() 