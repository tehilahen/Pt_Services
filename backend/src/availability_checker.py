"""
מודול בדיקת זמינות אתרים - Availability Checker

מודול זה בודק זמינות של אתרים לפני ביצוע סריקות אבטחה.
הבדיקה מתבצעת באמצעות HTTP/HTTPS requests ומזהה סטטוסים שונים.

דוגמאות שימוש:
    from src.availability_checker import availability_checker
    
    result = availability_checker.check_url('https://example.com')
    if result['available']:
        print(f"Site is available: {result['status_code']}")
    else:
        print(f"Site is unavailable: {result['error']}")
"""

import requests
import logging
from urllib.parse import urlparse
from datetime import datetime
import urllib3

# הגדרת לוגים
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# השבתת אזהרות SSL (לצורכי בדיקה בלבד)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class AvailabilityChecker:
    """בודק זמינות של אתרים לפני סריקות אבטחה"""
    
    def __init__(self, timeout=15):
        """
        אתחול ה-Availability Checker
        
        Args:
            timeout (int): זמן המתנה מקסימלי בשניות (ברירת מחדל: 15)
        """
        self.timeout = timeout
        self.session = requests.Session()
        # הגדרת User-Agent
        self.session.headers.update({
            'User-Agent': 'PT-Security-Scanner/1.0 (Availability Check)'
        })
        
        logger.info(f"Availability Checker initialized with timeout={timeout}s")
    
    def check_url(self, url):
        """
        בדיקת זמינות URL בודד
        
        Args:
            url (str): כתובת URL לבדיקה
            
        Returns:
            dict: {
                'available': bool,           # האם האתר זמין
                'status_code': int,          # קוד HTTP שהתקבל
                'response_time': float,      # זמן תגובה בשניות
                'final_url': str,            # URL סופי (אחרי redirects)
                'error': str,                # הודעת שגיאה (אם יש)
                'redirect_count': int        # מספר redirects
            }
        """
        start_time = datetime.now()
        
        try:
            logger.info(f"בודק זמינות של: {url}")
            
            # וולידציה בסיסית של URL
            parsed_url = urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                return {
                    'available': False,
                    'status_code': 0,
                    'response_time': 0,
                    'final_url': url,
                    'error': 'Invalid URL format',
                    'redirect_count': 0
                }
            
            # ביצוע בקשת HEAD (מהיר יותר מ-GET)
            # אם HEAD נכשל, ננסה GET
            try:
                response = self.session.head(
                    url,
                    timeout=self.timeout,
                    allow_redirects=True,
                    verify=False  # לא מאמת SSL certificates (לצורכי בדיקה)
                )
            except requests.exceptions.RequestException:
                # אם HEAD נכשל, ננסה GET
                logger.debug(f"HEAD request failed for {url}, trying GET")
                response = self.session.get(
                    url,
                    timeout=self.timeout,
                    allow_redirects=True,
                    verify=False,
                    stream=True  # לא מוריד את כל התוכן
                )
                # סגירת החיבור מיד
                response.close()
            
            # חישוב זמן תגובה
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            # ספירת redirects
            redirect_count = len(response.history)
            
            # קביעת זמינות לפי status code
            status_code = response.status_code
            available = self._is_available_status(status_code)
            
            # הכנת הודעת שגיאה אם לא זמין
            error_msg = None if available else self._get_error_message(status_code)
            
            result = {
                'available': available,
                'status_code': status_code,
                'response_time': round(response_time, 3),
                'final_url': response.url,
                'error': error_msg,
                'redirect_count': redirect_count
            }
            
            # לוג התוצאה
            if available:
                logger.info(f"✓ {url} זמין - HTTP {status_code} ({response_time:.3f}s)")
            else:
                logger.warning(f"✗ {url} לא זמין - HTTP {status_code}: {error_msg}")
            
            return result
            
        except requests.exceptions.Timeout:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            logger.warning(f"✗ {url} - Timeout אחרי {response_time:.1f}s")
            
            return {
                'available': False,
                'status_code': 0,
                'response_time': round(response_time, 3),
                'final_url': url,
                'error': f'חריגת זמן - השרת לא הגיב תוך {self.timeout} שניות',
                'redirect_count': 0
            }
            
        except requests.exceptions.ConnectionError as e:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            logger.warning(f"✗ {url} - Connection Error: {str(e)[:100]}")
            
            return {
                'available': False,
                'status_code': 0,
                'response_time': round(response_time, 3),
                'final_url': url,
                'error': 'לא ניתן להתחבר לשרת - בדוק את הכתובת והחיבור לאינטרנט',
                'redirect_count': 0
            }
            
        except requests.exceptions.TooManyRedirects:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            logger.warning(f"✗ {url} - Too Many Redirects")
            
            return {
                'available': False,
                'status_code': 0,
                'response_time': round(response_time, 3),
                'final_url': url,
                'error': 'יותר מדי redirects - האתר עלול להיות בלולאה אינסופית',
                'redirect_count': 0
            }
            
        except requests.exceptions.RequestException as e:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            logger.error(f"✗ {url} - Request Error: {str(e)[:100]}")
            
            return {
                'available': False,
                'status_code': 0,
                'response_time': round(response_time, 3),
                'final_url': url,
                'error': f'שגיאה בבקשה: {str(e)[:100]}',
                'redirect_count': 0
            }
            
        except Exception as e:
            end_time = datetime.now()
            response_time = (end_time - start_time).total_seconds()
            
            logger.error(f"✗ {url} - Unexpected Error: {str(e)}")
            
            return {
                'available': False,
                'status_code': 0,
                'response_time': round(response_time, 3),
                'final_url': url,
                'error': f'שגיאה לא צפויה: {str(e)}',
                'redirect_count': 0
            }
    
    def _is_available_status(self, status_code):
        """
        קביעה האם status code מעיד על זמינות
        
        Args:
            status_code (int): קוד HTTP
            
        Returns:
            bool: True אם האתר נחשב זמין
        """
        # 2xx - Success
        if 200 <= status_code < 300:
            return True
        
        # 3xx - Redirection (נחשב זמין כי הבקשה הצליחה)
        if 300 <= status_code < 400:
            return True
        
        # כל השאר - לא זמין
        return False
    
    def _get_error_message(self, status_code):
        """
        קבלת הודעת שגיאה מתאימה לפי status code
        
        Args:
            status_code (int): קוד HTTP
            
        Returns:
            str: הודעת שגיאה בעברית
        """
        if status_code == 400:
            return 'בקשה שגויה (400 Bad Request)'
        elif status_code == 401:
            return 'נדרש אימות (401 Unauthorized)'
        elif status_code == 403:
            return 'גישה נדחתה (403 Forbidden)'
        elif status_code == 404:
            return 'הדף לא נמצא (404 Not Found)'
        elif status_code == 405:
            return 'Method לא נתמך (405 Method Not Allowed)'
        elif status_code == 408:
            return 'חריגת זמן בבקשה (408 Request Timeout)'
        elif 400 <= status_code < 500:
            return f'שגיאת לקוח (HTTP {status_code})'
        elif status_code == 500:
            return 'שגיאת שרת פנימית (500 Internal Server Error)'
        elif status_code == 502:
            return 'Bad Gateway (502)'
        elif status_code == 503:
            return 'השירות לא זמין (503 Service Unavailable)'
        elif status_code == 504:
            return 'Gateway Timeout (504)'
        elif 500 <= status_code < 600:
            return f'שגיאת שרת (HTTP {status_code})'
        else:
            return f'סטטוס לא ידוע (HTTP {status_code})'
    
    def check_multiple_urls(self, urls):
        """
        בדיקת זמינות של מספר URLs
        
        Args:
            urls (list): רשימת URLs לבדיקה
            
        Returns:
            list: רשימת תוצאות (dict לכל URL)
        """
        results = []
        
        logger.info(f"בודק זמינות של {len(urls)} אתרים")
        
        for i, url in enumerate(urls, 1):
            logger.info(f"[{i}/{len(urls)}] בודק: {url}")
            result = self.check_url(url)
            result['url'] = url  # הוספת ה-URL המקורי לתוצאה
            results.append(result)
        
        # סיכום
        available_count = sum(1 for r in results if r['available'])
        logger.info(f"סיכום: {available_count}/{len(urls)} אתרים זמינים")
        
        return results


# יצירת מופע גלובלי
availability_checker = AvailabilityChecker(timeout=15)
