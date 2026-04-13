"""
שרת API Flask - נקודת הכניסה הראשית לשרת הבקאנד
דף זה מספק את כל ה-endpoints של ה-API:
- ניהול סריקות Nikto (הפעלה, מעקב סטטוס)
- ניהול מערכות (שליפה, פרטים, חולשות)
- ניהול משתמשים (התחברות, התנתקות, איפוס סיסמה)
- סטטיסטיקות ודוחות
- שליחת בקשות סריקה במייל
- אימות JWT לכל הבקשות המוגנות
"""
from flask import Flask, jsonify, request, session
from flask_cors import CORS
import logging
from src.database import db_connection
from src.nikto_executor import nikto_executor
from src.stitch import stitch_executor
from src.email_service import email_service
from src.availability_checker import availability_checker
from src.code_review_orchestrator import code_review_orchestrator
from src.jwt_auth import (
    create_access_token,
    jwt_required,
    jwt_optional,
    admin_required,
    get_token_from_request,
    decode_token
)
import jwt
import os
import re

# הגדרת לוגים
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# יצירת אפליקציית Flask
app = Flask(__name__)
# השבתת redirect אוטומטי של trailing slashes
app.url_map.strict_slashes = False
# הגדרת מפתח סודי לסשנים
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')

# הגדרת CORS - ברירת מחדל: localhost בלבד (לפיתוח)
# בפרודקשן יש להגדיר CORS_ORIGINS ב-.env עם כתובות הפרודקשן
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]
logger.info(f"CORS מוגדר לדומיינים: {cors_origins}")
CORS(app, supports_credentials=True, origins=cors_origins)  # אפשור CORS לדומיינים מורשים

# וידוא שהאפליקציה מתחילה נכון
logger.info("Flask app initialized")

def log_registered_routes():
    """רישום כל ה-routes הרשומים"""
    logger.info("=== Registered Routes ===")
    for rule in app.url_map.iter_rules():
        logger.info(f"Route: {rule.rule} | Methods: {rule.methods} | Endpoint: {rule.endpoint}")
    logger.info("========================")

# רישום routes בעת טעינת המודול
log_registered_routes()

def get_current_user():
    """
    חילוץ פרטי המשתמש מ-JWT token, מהסשן, או מ-Headers (fallback לתאימות אחורה)
    
    סדר עדיפות:
    1. JWT token (הכי מאובטח)
    2. Session
    3. X-User-ID / X-User-Type-ID Headers (לתאימות אחורה - יש לעדכן את הקליינט)
    
    Returns:
        tuple: (user_id, user_type_id) או (None, None) אם לא מאומת
    """
    # ניסיון ראשון: JWT token (הכי מאובטח)
    token = get_token_from_request()
    if token:
        try:
            payload = decode_token(token)
            return payload.get('user_id'), payload.get('user_type_id')
        except jwt.ExpiredSignatureError:
            logger.debug("JWT token פג תוקף")
        except jwt.InvalidTokenError:
            logger.debug("JWT token לא תקין")
    
    # ניסיון שני: סשן
    user_id = session.get('user_id')
    if user_id:
        user_type_id = session.get('user_type_id')
        if not user_type_id:
            user_data = db_connection.get_user_by_id(user_id)
            if user_data:
                user_type_id = user_data.get('user_type_id')
                session['user_type_id'] = user_type_id
        return user_id, user_type_id
    
    # ניסיון שלישי: Headers ישנים (לתאימות אחורה עד שהקליינט יעודכן)
    # הערה: זה פחות מאובטח - יש לעדכן את הקליינט לשימוש ב-JWT
    header_user_id = request.headers.get('X-User-ID')
    header_user_type_id = request.headers.get('X-User-Type-ID')
    
    if header_user_id:
        try:
            user_id = int(header_user_id)
            user_type_id = int(header_user_type_id) if header_user_type_id else None
            logger.debug(f"שימוש ב-Headers לתאימות אחורה - User ID: {user_id}")
            return user_id, user_type_id
        except (ValueError, TypeError):
            pass
    
    return None, None

@app.before_request
def log_request_info():
    """רישום בקשות נכנסות - מופחת לשיפור ביצועים"""
    # רישום מינימלי - רק method ו-path
    logger.debug(f"{request.method} {request.path}")

@app.route('/', methods=['GET'])
def health_check():
    """בדיקת תקינות השרת"""
    return jsonify({'status': 'ok', 'message': 'API Server is running'}), 200

@app.route('/api/health', methods=['GET'])
def api_health():
    """בדיקת תקינות API"""
    return jsonify({'status': 'ok', 'message': 'API is healthy'}), 200

@app.errorhandler(404)
def not_found(error):
    """טיפול בבקשות שלא נמצאו"""
    logger.warning(f"בקשה לא נמצאה: {request.method} {request.path}")
    return jsonify({
        'success': False,
        'message': 'Route not found',
        'error': f'{request.method} {request.path} is not a valid endpoint'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    """טיפול בשיטות לא מורשות"""
    logger.warning(f"שיטה לא מורשת: {request.method} {request.path}")
    return jsonify({
        'success': False,
        'message': 'Method not allowed',
        'error': f'{request.method} is not allowed for {request.path}'
    }), 405

@app.route('/api/scans/initiate', methods=['POST'])
def initiate_scan():
    """הפעלת סריקה (Nikto או Stitch) – רק לאדמין או למנהל המערכת"""
    try:
        logger.info(f"Received request to /api/scans/initiate - Method: {request.method}, Headers: {dict(request.headers)}")
        user_id, user_type_id = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401

        data = request.get_json()
        
        # וולידציה
        if not data or 'system_id' not in data:
            response = jsonify({
                'success': False,
                'message': 'חסר מערכת ID',
                'error': 'system_id is required'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
        system_id = data['system_id']
        if not db_connection.user_can_access_system(user_id, user_type_id, system_id):
            return jsonify({'success': False, 'message': 'אין הרשאה להפעיל סריקה למערכת זו'}), 403

        scan_source = data.get('scan_source', 'Nikto')  # ברירת מחדל: Nikto
        
        # וולידציה של scan_source
        if scan_source not in ['Nikto', 'Stitch']:
            response = jsonify({
                'success': False,
                'message': 'מקור סריקה לא חוקי',
                'error': 'scan_source must be either Nikto or Stitch'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
        # בדיקה שהמערכת קיימת
        system_info = db_connection.get_system_url(system_id)
        if not system_info:
            response = jsonify({
                'success': False,
                'message': 'מערכת לא נמצאה',
                'error': f'System {system_id} not found'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 404
        
        # בדיקה שיש URL למערכת
        if not system_info.get('URL') or system_info.get('URL').strip() == '':
            response = jsonify({
                'success': False,
                'message': 'אין URL מוגדר למערכת',
                'error': 'System has no URL configured'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 400
        
        target_url = system_info.get('URL')
        
        # *** בדיקת זמינות לפני סריקה ***
        logger.info(f"בודק זמינות של {target_url} לפני סריקה")
        availability_result = availability_checker.check_url(target_url)
        
        if not availability_result['available']:
            # המערכת לא זמינה - חסימת הסריקה
            status_code = availability_result.get('status_code', 'N/A')
            error_msg = availability_result.get('error', 'Unknown error')
            response_time = availability_result.get('response_time', 0)
            
            logger.warning(f"המערכת {target_url} לא זמינה: HTTP {status_code} - {error_msg}")
            logger.debug(f"Availability result: {availability_result}")
            
            # הכנת הודעה ברורה עם הסטטוס
            if status_code == 0 or status_code == 'N/A':
                user_message = f'המערכת לא זמינה - {error_msg}'
                detailed_message = f'המערכת לא זמינה: {error_msg}'
            else:
                user_message = f'המערכת החזירה סטטוס HTTP {status_code}'
                detailed_message = f'המערכת החזירה סטטוס HTTP {status_code} - {error_msg}'
            
            logger.info(f"User message prepared: {user_message}")
            logger.info(f"Detailed message: {detailed_message}")
            
            response = jsonify({
                'success': False,
                'message': detailed_message,
                'error': error_msg,
                'status_code': status_code,
                'availability_check': {
                    'status_code': status_code,
                    'response_time': response_time,
                    'error': error_msg,
                    'url': target_url
                }
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 503  # Service Unavailable
        
        # המערכת זמינה - המשך בסריקה
        logger.info(f"המערכת זמינה (HTTP {availability_result['status_code']}, {availability_result['response_time']}s) - ממשיך בסריקה")
        
        logger.info(f"הפעלת סריקה {scan_source} - SystemID: {system_id}, URL: {target_url}")
        
        # יצירת רשומת סריקה עם סטטוס ומקור
        logger.info(f"Attempting to create scan record for SystemID: {system_id}, Source: {scan_source}")
        scan_id = db_connection.create_scan_with_status(system_id, 'starting', scan_source=scan_source)
        
        logger.info(f"create_scan_with_status returned: {scan_id}")
        
        if not scan_id:
            logger.error("Failed to create scan record - scan_id is None")
            response = jsonify({
                'success': False,
                'message': 'שגיאה ביצירת רשומת סריקה',
                'error': 'Failed to create scan record',
                'system_id': system_id
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 500
        
        # בחירת executor לפי מקור הסריקה
        if scan_source == 'Stitch':
            thread = stitch_executor.execute_scan_async(system_id, scan_id)
            logger.info(f"סריקת Stitch הופעלה בהצלחה - ScanID: {scan_id}")
        else:
            thread = nikto_executor.execute_scan_async(system_id, scan_id)
            logger.info(f"סריקת Nikto הופעלה בהצלחה - ScanID: {scan_id}")
        
        response = jsonify({
            'success': True,
            'scan_id': scan_id,
            'system_id': system_id,
            'scan_source': scan_source,
            'target_url': system_info.get('URL'),
            'message': f'סריקת {scan_source} הופעלה בהצלחה. ניתן לעקוב אחר הסטטוס דרך API.'
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 200
        
    except Exception as e:
        logger.error(f"שגיאה בהפעלת סריקה: {str(e)}")
        response = jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/api/scans/<int:scan_id>/vulnerabilities', methods=['GET'])
def get_scan_vulnerabilities(scan_id):
    """שליפת חולשות של סריקה ספציפית"""
    try:
        logger.info(f"בקשה לשליפת חולשות סריקה {scan_id}")
        
        vulnerabilities = db_connection.get_vulnerabilities_by_scan(scan_id)
        
        if vulnerabilities is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת חולשות',
                'vulnerabilities': []
            }), 500
        
        return jsonify({
            'success': True,
            'vulnerabilities': vulnerabilities,
            'count': len(vulnerabilities),
            'scan_id': scan_id
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת חולשות סריקה {scan_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'vulnerabilities': []
        }), 500

@app.route('/api/scans/<int:scan_id>/status', methods=['GET'])
def get_scan_status_endpoint(scan_id):
    """שליפת סטטוס סריקה"""
    try:
        # TODO: הוסף מנגנון אימות אמיתי (JWT/Token/Session)
        
        logger.info(f"בקשה לסטטוס סריקה {scan_id}")
        
        scan_info = db_connection.get_scan_status(scan_id)
        
        if not scan_info:
            response = jsonify({
                'success': False,
                'message': 'סריקה לא נמצאה',
                'error': f'Scan {scan_id} not found'
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response, 404
        
        # המרת סטטוס לעברית לאנגלית
        status = scan_info.get('Status')
        status_map = {
            'הצליח': 'completed',
            'נכשל': 'failed',
            'ממתין': 'pending'
        }
        status_en = status_map.get(status, 'unknown')
        
        response_data = {
            'success': True,
            'scan_id': scan_id,
            'status': status_en,
            'system_name': scan_info.get('SystemName'),
            'target_url': scan_info.get('URL'),
            'start_date': scan_info.get('start_date').isoformat() if scan_info.get('start_date') else None,
            'end_date': scan_info.get('End_date').isoformat() if scan_info.get('End_date') else None
        }
        
        response = jsonify(response_data)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סטטוס סריקה {scan_id}: {str(e)}")
        response = jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        })
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 500

@app.route('/api/systems', methods=['GET'])
def get_systems():
    """שליפת מערכות - מסוננות לפי הרשאות המשתמש"""
    try:
        logger.info("בקשה לשליפת מערכות")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        logger.info(f"User ID: {user_id}, User Type ID: {user_type_id}")
        
        systems = db_connection.get_systems(user_id=user_id, user_type_id=user_type_id)
        
        if systems is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת מערכות',
                'systems': []
            }), 500
        
        return jsonify({
            'success': True,
            'systems': systems,
            'count': len(systems)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת מערכות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'systems': []
        }), 500

@app.route('/api/systems/<int:system_id>', methods=['GET'])
def get_system(system_id):
    """שליפת מערכת ספציפית"""
    try:
        logger.info(f"בקשה לשליפת מערכת {system_id}")
        
        system = db_connection.get_system_details(system_id)
        
        if not system:
            return jsonify({
                'success': False,
                'message': 'מערכת לא נמצאה',
                'error': f'System {system_id} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'system': system
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת מערכת {system_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/systems/<int:system_id>/vulnerabilities', methods=['GET'])
def get_system_vulnerabilities(system_id):
    """שליפת חולשות של מערכת"""
    try:
        logger.info(f"בקשה לשליפת חולשות מערכת {system_id}")
        
        vulnerabilities = db_connection.get_vulnerabilities_by_system(system_id)
        
        if vulnerabilities is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת חולשות',
                'vulnerabilities': []
            }), 500
        
        return jsonify({
            'success': True,
            'vulnerabilities': vulnerabilities,
            'count': len(vulnerabilities)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת חולשות מערכת {system_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'vulnerabilities': []
        }), 500

@app.route('/api/scans', methods=['GET'])
def get_all_scans():
    """שליפת סריקות - מסוננות לפי הרשאות המשתמש"""
    try:
        logger.info("בקשה לשליפת סריקות")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        scans = db_connection.get_all_scans(user_id=user_id, user_type_id=user_type_id)
        
        if scans is None:
            logger.error("get_all_scans returned None - database error occurred")
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת סריקות',
                'scans': [],
                'count': 0
            }), 500
        
        # Ensure scans is a list
        if not isinstance(scans, list):
            logger.warning(f"get_all_scans returned non-list: {type(scans)}")
            scans = []
        
        return jsonify({
            'success': True,
            'scans': scans,
            'count': len(scans) if scans else 0
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סריקות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'scans': [],
            'count': 0
        }), 500


# ===============================
# Code Reviews (סריקות קוד)
# ===============================

@app.route('/api/code-reviews', methods=['POST'])
def start_code_review():
    """הפעלת סריקת קוד חדשה – רק לאדמין או למנהל המערכת"""
    try:
        user_id, user_type_id = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401

        data = request.get_json()
        if not data or 'system_id' not in data:
            return jsonify({'success': False, 'message': 'נדרש שדה system_id'}), 400

        system_id = data['system_id']
        if not db_connection.user_can_access_system(user_id, user_type_id, system_id):
            return jsonify({'success': False, 'message': 'אין הרשאה להפעיל סריקת קוד למערכת זו'}), 403

        task_id = code_review_orchestrator.start_code_review(system_id, user_id)
        return jsonify({
            'success': True,
            'message': 'סריקת קוד הופעלה בהצלחה',
            'task_id': task_id
        }), 201
    except ValueError as e:
        logger.warning(f"שגיאה בהפעלת סריקת קוד: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 400
    except Exception as e:
        logger.error(f"שגיאה בהפעלת סריקת קוד: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בהפעלת סריקת קוד'}), 500


@app.route('/api/code-reviews', methods=['GET'])
def get_code_reviews():
    """שליפת רשימת סריקות קוד - אדמין רואה הכל, מנהל מערכת רק סריקות של מערכותיו"""
    try:
        user_id, user_type_id = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        system_id = request.args.get('system_id', type=int)
        reviews = db_connection.get_code_reviews(system_id=system_id, user_id=user_id, user_type_id=user_type_id)
        return jsonify({
            'success': True,
            'reviews': reviews,
            'count': len(reviews)
        }), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת סריקות קוד: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בשליפת סריקות קוד'}), 500


@app.route('/api/code-reviews/findings/<int:finding_id>/status', methods=['PUT'])
def update_code_review_finding_status(finding_id):
    """עדכון סטטוס ממצא של סריקת קוד"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'success': False, 'message': 'נדרש שדה status'}), 400
        status = data['status']
        valid_statuses = ['בטיפול', 'טופל', 'התעלם', 'סגור']
        if status not in valid_statuses:
            return jsonify({'success': False, 'message': f'סטטוס לא תקין. ערכים: {", ".join(valid_statuses)}'}), 400
        if db_connection.update_code_review_finding_status(finding_id, status):
            return jsonify({'success': True, 'message': 'סטטוס עודכן בהצלחה'}), 200
        return jsonify({'success': False, 'message': 'ממצא לא נמצא'}), 404
    except Exception as e:
        logger.error(f"שגיאה בעדכון סטטוס ממצא {finding_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בעדכון'}), 500


@app.route('/api/code-reviews/<int:task_id>', methods=['GET'])
def get_code_review(task_id):
    """שליפת פרטי סריקת קוד בודדת"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        review = db_connection.get_code_review(task_id)
        if not review:
            return jsonify({'success': False, 'message': 'סריקת קוד לא נמצאה'}), 404
        return jsonify({'success': True, 'review': review}), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת סריקת קוד {task_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בשליפת סריקת קוד'}), 500


@app.route('/api/code-reviews/<int:task_id>/status', methods=['GET'])
def get_code_review_status(task_id):
    """שליפת סטטוס סריקת קוד (לעדכון תקופתי)"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        review = db_connection.get_code_review(task_id)
        if not review:
            return jsonify({'success': False, 'message': 'סריקת קוד לא נמצאה'}), 404
        return jsonify({
            'success': True,
            'task_id': task_id,
            'status': review.get('status'),
            'started_at': review.get('started_at'),
            'finished_at': review.get('finished_at'),
            'error_summary': review.get('error_summary')
        }), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת סטטוס code review {task_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בשליפת סטטוס'}), 500


@app.route('/api/code-reviews/<int:task_id>/findings', methods=['GET'])
def get_code_review_findings(task_id):
    """שליפת ממצאי סריקת קוד"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        findings = db_connection.get_code_review_findings(task_id)
        severity_counts = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
        for f in findings:
            sev = f.get('severity', 'Medium')
            if sev in severity_counts:
                severity_counts[sev] += 1
        return jsonify({
            'success': True,
            'findings': findings,
            'count': len(findings),
            'severity_counts': severity_counts
        }), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת ממצאי code review {task_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בשליפת ממצאים'}), 500


@app.route('/api/code-reviews/<int:task_id>/report', methods=['GET'])
def get_code_review_report(task_id):
    """שליפת דוח HTML של סריקת קוד"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        artifact = db_connection.get_code_review_artifact(task_id, 'security-report.html')
        if not artifact:
            return jsonify({'success': False, 'message': 'דוח לא נמצא'}), 404
        content = artifact.get('content')
        if content is None:
            return jsonify({'success': False, 'message': 'דוח לא נמצא'}), 404
        if isinstance(content, bytes):
            content = content.decode('utf-8', errors='replace')
        return jsonify({'success': True, 'report_html': content}), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת דוח code review {task_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בשליפת דוח'}), 500


@app.route('/api/code-reviews/<int:task_id>/report/download', methods=['GET'])
def download_code_review_report(task_id):
    """הורדת דוח HTML כקובץ"""
    try:
        user_id, _ = get_current_user()
        if user_id is None:
            return jsonify({'success': False, 'message': 'נדרשת התחברות'}), 401
        artifact = db_connection.get_code_review_artifact(task_id, 'security-report.html')
        if not artifact:
            return jsonify({'success': False, 'message': 'דוח לא נמצא'}), 404
        content = artifact.get('content')
        if content is None:
            return jsonify({'success': False, 'message': 'דוח לא נמצא'}), 404
        if isinstance(content, str):
            content = content.encode('utf-8')
        from flask import Response
        return Response(
            content,
            mimetype='text/html',
            headers={'Content-Disposition': f'attachment; filename=security-report-task-{task_id}.html'}
        )
    except Exception as e:
        logger.error(f"שגיאה בהורדת דוח code review {task_id}: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה בהורדת דוח'}), 500


@app.route('/api/vulnerabilities', methods=['GET'])
def get_all_vulnerabilities():
    """שליפת חולשות - מסוננות לפי הרשאות המשתמש"""
    try:
        logger.info("בקשה לשליפת חולשות")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        vulnerabilities = db_connection.get_all_vulnerabilities(user_id=user_id, user_type_id=user_type_id)
        
        if vulnerabilities is None:
            logger.error("get_all_vulnerabilities returned None - database error occurred")
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת חולשות',
                'vulnerabilities': []
            }), 500
        
        # Ensure vulnerabilities is a list
        if not isinstance(vulnerabilities, list):
            logger.warning(f"get_all_vulnerabilities returned non-list: {type(vulnerabilities)}")
            vulnerabilities = []
        
        return jsonify({
            'success': True,
            'vulnerabilities': vulnerabilities,
            'count': len(vulnerabilities) if vulnerabilities else 0
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת חולשות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'vulnerabilities': []
        }), 500

@app.route('/api/vulnerabilities/recurring', methods=['GET'])
def get_recurring_vulnerabilities():
    """שליפת חולשות חוזרות - חולשות גבוהות וקריטיות שמופיעות במספר מערכות"""
    try:
        logger.info("בקשה לשליפת חולשות חוזרות")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        # קבלת מספר מערכות מינימלי מה-query string (ברירת מחדל: 3)
        min_systems = request.args.get('min_systems', 3, type=int)
        
        vulnerabilities = db_connection.get_recurring_vulnerabilities(
            user_id=user_id, 
            user_type_id=user_type_id,
            min_systems=min_systems
        )
        
        if vulnerabilities is None:
            logger.error("get_recurring_vulnerabilities returned None - database error occurred")
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת חולשות חוזרות',
                'vulnerabilities': []
            }), 500
        
        # Ensure vulnerabilities is a list
        if not isinstance(vulnerabilities, list):
            logger.warning(f"get_recurring_vulnerabilities returned non-list: {type(vulnerabilities)}")
            vulnerabilities = []
        
        return jsonify({
            'success': True,
            'vulnerabilities': vulnerabilities,
            'count': len(vulnerabilities) if vulnerabilities else 0,
            'min_systems': min_systems
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת חולשות חוזרות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'vulnerabilities': []
        }), 500

@app.route('/api/dashboard-data', methods=['GET'])
def get_dashboard_data():
    """נקודת קצה משולבת לדף הבית - מפחית RTT משמעותית
    מחזיר את כל הנתונים הנדרשים לדף הבית בקריאה אחת"""
    try:
        logger.info("בקשה לנתוני דאשבורד משולבים")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        # שליפת כל הנתונים
        systems = db_connection.get_systems(user_id=user_id, user_type_id=user_type_id)
        stats = db_connection.get_statistics(user_id=user_id, user_type_id=user_type_id)
        status_stats = db_connection.get_vulnerability_status_stats(user_id=user_id, user_type_id=user_type_id)
        scans = db_connection.get_all_scans(user_id=user_id, user_type_id=user_type_id)
        
        return jsonify({
            'success': True,
            'systems': systems or [],
            'stats': stats or {
                'systems': {'total_systems': 0, 'unique_ips': 0},
                'vulnerabilities': {'total': 0, 'breakdown': {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}},
                'scans': {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
            },
            'status_stats': status_stats or {'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0},
            'scans_count': len(scans) if scans else 0
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת נתוני דאשבורד משולבים: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'systems': [],
            'stats': {
                'systems': {'total_systems': 0, 'unique_ips': 0},
                'vulnerabilities': {'total': 0, 'breakdown': {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}},
                'scans': {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
            },
            'status_stats': {'בטיפול': 0, 'טופל': 0, 'התעלם': 0, 'סגור': 0},
            'scans_count': 0
        }), 500


@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """שליפת סטטיסטיקות - מסוננות לפי הרשאות המשתמש"""
    try:
        logger.info("בקשה לשליפת סטטיסטיקות")
        
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        stats = db_connection.get_statistics(user_id=user_id, user_type_id=user_type_id)
        
        if stats is None:
            logger.error("get_statistics returned None - database error occurred")
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת סטטיסטיקות',
                'systems': {'total_systems': 0, 'unique_ips': 0},
                'vulnerabilities': {'total': 0, 'breakdown': {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}},
                'scans': {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
            }), 500
        
        # Ensure stats is a dict
        if not isinstance(stats, dict):
            logger.warning(f"get_statistics returned non-dict: {type(stats)}")
            stats = {
                'systems': {'total_systems': 0, 'unique_ips': 0},
                'vulnerabilities': {'total': 0, 'breakdown': {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}},
                'scans': {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
            }
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סטטיסטיקות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'systems': {'total_systems': 0, 'unique_ips': 0},
            'vulnerabilities': {'total': 0, 'breakdown': {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}},
            'scans': {'total_scans': 0, 'completed': 0, 'failed': 0, 'pending': 0}
        }), 500

@app.route('/api/vulnerabilities/<int:vuln_id>/status', methods=['PUT'])
def update_vulnerability_status(vuln_id):
    """עדכון סטטוס חולשה"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({
                'success': False,
                'message': 'חסר סטטוס'
            }), 400
        
        # תמיכה בכל הסטטוסים
        valid_statuses = ['בטיפול', 'טופל', 'התעלם', 'סגור']
        if new_status not in valid_statuses:
            return jsonify({
                'success': False,
                'message': f'סטטוס לא חוקי. ערכים אפשריים: {", ".join(valid_statuses)}'
            }), 400
        
        success = db_connection.update_vulnerability_status(vuln_id, new_status)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'סטטוס חולשה {vuln_id} עודכן ל-{new_status}'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'שגיאה בעדכון סטטוס'
            }), 500
            
    except Exception as e:
        logger.error(f"שגיאה בעדכון סטטוס חולשה: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/stats/vulnerabilities-status', methods=['GET'])
def get_vulnerabilities_status_stats():
    """קבלת סטטיסטיקות סטטוס חולשות"""
    try:
        # קבלת פרטי המשתמש מ-JWT token או מהסשן
        user_id, user_type_id = get_current_user()
        
        stats = db_connection.get_vulnerability_status_stats(user_id=user_id, user_type_id=user_type_id)
        
        return jsonify({
            'success': True,
            'status_stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סטטיסטיקות סטטוס: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e),
            'status_stats': {'בטיפול': 0, 'טופל': 0}
        }), 500

@app.route('/api/scan-request', methods=['POST'])
def scan_request():
    """בקשה לסריקה במייל"""
    try:
        data = request.get_json()
        
        requester_name = data.get('requesterName', '')
        requester_email = data.get('requesterEmail', '')
        requester_phone = data.get('requesterPhone', '')
        system_name = data.get('systemName', '')
        system_url = data.get('systemUrl', '')
        details = data.get('details', '')
        
        if not requester_name or not system_name:
            return jsonify({
                'success': False,
                'message': 'חסרים פרטים חובה (שם פונה ושם מערכת)'
            }), 400
        
        # שליחת מייל למנהל המערכת
        email_body = f"""
        בקשה חדשה לבדיקת מערכת
        
        פרטי הפונה:
        שם: {requester_name}
        דוא"ל: {requester_email}
        טלפון: {requester_phone}
        
        פרטי המערכת:
        שם המערכת: {system_name}
        כתובת URL: {system_url}
        
        פרטים נוספים:
        {details}
        """
        
        # שליחת מייל (אם השירות מוגדר)
        try:
            admin_email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
            email_service.send_email(
                to_email=admin_email,
                subject=f'בקשה חדשה לבדיקת מערכת: {system_name}',
                body=email_body
            )
            logger.info(f"נשלח מייל על בקשת סריקה למערכת {system_name}")
        except Exception as email_error:
            logger.warning(f"לא ניתן לשלוח מייל: {str(email_error)}")
        
        return jsonify({
            'success': True,
            'message': 'הבקשה נשלחה בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בבקשת סריקה: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """התחברות משתמש - מחזיר JWT token"""
    try:
        data = request.get_json()
        username = data.get('username', '')
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'חסרים שם משתמש או סיסמה'
            }), 400
        
        # אימות משתמש
        user = db_connection.authenticate_user(username, password)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'שם משתמש או סיסמה שגויים'
            }), 401
        
        # עדכון זמן התחברות אחרון
        db_connection.update_last_login(user['user_id'])
        
        # יצירת JWT token
        access_token = create_access_token(
            user_id=user['user_id'],
            username=user['username'],
            user_type_id=user.get('user_type_id'),
            email=user.get('email'),
            full_name=user.get('full_name')
        )
        
        # שמירת המשתמש בסשן (לתאימות אחורה)
        session['user_id'] = user['user_id']
        session['username'] = user['username']
        
        logger.info(f"User logged in: {username}, user_type_id: {user.get('user_type_id')}")
        
        return jsonify({
            'success': True,
            'message': 'התחברת בהצלחה',
            'token': access_token,
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'email': user.get('email'),
                'full_name': user.get('full_name'),
                'user_type_id': user.get('user_type_id')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בהתחברות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """התנתקות משתמש"""
    try:
        session.clear()
        return jsonify({
            'success': True,
            'message': 'התנתקת בהצלחה'
        }), 200
    except Exception as e:
        logger.error(f"שגיאה בהתנתקות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """בקשת איפוס סיסמה"""
    try:
        data = request.get_json()
        email = data.get('email', '')
        
        if not email:
            return jsonify({
                'success': False,
                'message': 'חסר כתובת דוא"ל'
            }), 400
        
        # יצירת טוקן איפוס
        reset_info = db_connection.create_password_reset_token(email)
        
        if not reset_info:
            # לא מחזירים שגיאה ספציפית כדי לא לחשוף מידע על משתמשים
            return jsonify({
                'success': True,
                'message': 'אם הדוא"ל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה'
            }), 200
        
        # שליחת מייל עם קישור איפוס
        try:
            # כתובת האתר מ-environment variable - לפרודקשן ולפיתוח
            frontend_url = os.getenv('FRONTEND_URL')
            reset_link = f"{frontend_url}/reset-password?token={reset_info['reset_token']}"
            email_body = f"""
            שלום {reset_info['full_name']},
            
            קיבלנו בקשה לאיפוס סיסמה עבור חשבונך.
            
            לאיפוס הסיסמה, לחץ על הקישור הבא:
            {reset_link}
            
            הקישור תקף ל-24 שעות.
            
            אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.
            """
            
            email_service.send_email(
                to_email=email,
                subject='איפוס סיסמה',
                body=email_body
            )
            logger.info(f"נשלח מייל איפוס סיסמה ל-{email}")
        except Exception as email_error:
            logger.warning(f"לא ניתן לשלוח מייל איפוס: {str(email_error)}")
        
        return jsonify({
            'success': True,
            'message': 'אם הדוא"ל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה באיפוס סיסמה: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """איפוס סיסמה עם טוקן"""
    try:
        data = request.get_json()
        token = data.get('token', '')
        new_password = data.get('newPassword', '')
        
        if not token or not new_password:
            return jsonify({
                'success': False,
                'message': 'חסרים פרטים (טוקן או סיסמה חדשה)'
            }), 400
        
        # איפוס סיסמה
        success = db_connection.reset_password_with_token(token, new_password)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'טוקן לא תקף או פג תוקפו'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'הסיסמה אופסה בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה באיפוס סיסמה: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


# ===============================
# Admin API Endpoints - ניהול משתמשים
# ===============================

def require_admin():
    """בדיקת הרשאת Admin - מחזיר user_id אם מורשה, אחרת None"""
    # קבלת פרטי המשתמש מ-JWT token או מהסשן
    user_id, user_type_id = get_current_user()
    
    if not user_id:
        return None
    
    # בדיקה מהירה מה-token (UserTypeID = 1 הוא Admin)
    if user_type_id == 1:
        return user_id
    
    # אם לא נמצא ב-token, בדיקה ממסד הנתונים
    if not db_connection.is_admin(user_id):
        return None
    
    return user_id


@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    """שליפת כל המשתמשים (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        logger.info(f"Admin {admin_id} מבקש רשימת משתמשים")
        
        users = db_connection.get_all_users()
        
        if users is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת משתמשים',
                'users': []
            }), 500
        
        return jsonify({
            'success': True,
            'users': users,
            'count': len(users)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת משתמשים: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users', methods=['POST'])
def admin_create_user():
    """יצירת משתמש חדש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        data = request.get_json()
        
        # וולידציה
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = data.get('email', '').strip()
        full_name = data.get('full_name', '').strip()
        user_type_id = data.get('user_type_id', 3)  # ברירת מחדל: System Manager
        
        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'חסרים שם משתמש או סיסמה'
            }), 400
        
        # יצירת המשתמש
        new_user_id = db_connection.create_user(
            username=username,
            password=password,
            email=email,
            full_name=full_name,
            user_type_id=user_type_id
        )
        
        if not new_user_id:
            return jsonify({
                'success': False,
                'message': 'שגיאה ביצירת משתמש - ייתכן ששם המשתמש כבר קיים'
            }), 400
        
        logger.info(f"Admin {admin_id} יצר משתמש חדש: {username} (ID: {new_user_id})")
        
        return jsonify({
            'success': True,
            'message': 'משתמש נוצר בהצלחה',
            'user_id': new_user_id
        }), 201
        
    except Exception as e:
        logger.error(f"שגיאה ביצירת משתמש: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>', methods=['GET'])
def admin_get_user(user_id):
    """שליפת משתמש ספציפי (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        user = db_connection.get_user_by_id(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'משתמש לא נמצא'
            }), 404
        
        return jsonify({
            'success': True,
            'user': user
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
def admin_update_user(user_id):
    """עדכון משתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        data = request.get_json()
        
        # עדכון המשתמש
        success = db_connection.update_user(
            user_id=user_id,
            username=data.get('username'),
            email=data.get('email'),
            full_name=data.get('full_name'),
            user_type_id=data.get('user_type_id'),
            is_active=data.get('is_active')
        )
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'שגיאה בעדכון משתמש - ייתכן ששם המשתמש כבר קיים'
            }), 400
        
        logger.info(f"Admin {admin_id} עדכן משתמש: ID {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'משתמש עודכן בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בעדכון משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def admin_deactivate_user(user_id):
    """השבתת משתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        # מניעת השבתת עצמי
        if admin_id == user_id:
            return jsonify({
                'success': False,
                'message': 'לא ניתן להשבית את המשתמש שלך'
            }), 400
        
        success = db_connection.deactivate_user(user_id)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'שגיאה בהשבתת משתמש'
            }), 400
        
        logger.info(f"Admin {admin_id} השבית משתמש: ID {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'משתמש הושבת בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בהשבתת משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/user-types', methods=['GET'])
def admin_get_user_types():
    """שליפת סוגי הרשאות (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        user_types = db_connection.get_user_types()
        
        if user_types is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת סוגי הרשאות',
                'user_types': []
            }), 500
        
        return jsonify({
            'success': True,
            'user_types': user_types
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סוגי הרשאות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>/systems', methods=['GET'])
def admin_get_user_systems(user_id):
    """שליפת מערכות של משתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        systems = db_connection.get_user_systems(user_id)
        
        if systems is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת מערכות משתמש',
                'systems': []
            }), 500
        
        return jsonify({
            'success': True,
            'systems': systems,
            'count': len(systems)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת מערכות משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>/systems', methods=['PUT'])
def admin_update_user_systems(user_id):
    """עדכון מערכות של משתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        data = request.get_json()
        system_ids = data.get('system_ids', [])
        
        success = db_connection.update_user_systems(user_id, system_ids)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'שגיאה בעדכון מערכות משתמש'
            }), 400
        
        logger.info(f"Admin {admin_id} עדכן מערכות למשתמש {user_id}: {system_ids}")
        
        return jsonify({
            'success': True,
            'message': 'מערכות משתמש עודכנו בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בעדכון מערכות משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
def admin_reset_user_password(user_id):
    """איפוס סיסמה למשתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        data = request.get_json()
        new_password = data.get('new_password', '')
        
        if not new_password:
            return jsonify({
                'success': False,
                'message': 'חסרה סיסמה חדשה'
            }), 400
        
        success = db_connection.admin_reset_password(user_id, new_password)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'שגיאה באיפוס סיסמה'
            }), 400
        
        logger.info(f"Admin {admin_id} איפס סיסמה למשתמש {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'סיסמה אופסה בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה באיפוס סיסמה למשתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


@app.route('/api/admin/systems', methods=['GET'])
def admin_get_all_systems():
    """שליפת כל המערכות לבחירה (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        systems = db_connection.get_all_systems_for_selection()
        
        if systems is None:
            return jsonify({
                'success': False,
                'message': 'שגיאה בשליפת מערכות',
                'systems': []
            }), 500
        
        return jsonify({
            'success': True,
            'systems': systems,
            'count': len(systems)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת מערכות: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


# ===============================
# מעקב סריקות PT ידניות (Admin)
# ===============================

@app.route('/api/admin/pt-tracking', methods=['GET'])
def admin_pt_tracking_list():
    """רשימת כל המעקבים PT ידני (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403
        items = db_connection.get_manual_pt_tracking_list()
        if items is None:
            return jsonify({'success': False, 'message': 'שגיאה בשליפת נתונים', 'items': []}), 500
        return jsonify({'success': True, 'items': items}), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת מעקב PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500


@app.route('/api/admin/pt-tracking', methods=['POST'])
def admin_pt_tracking_create():
    """יצירת רשומת מעקב PT ידני (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403
        data = request.get_json() or {}
        system_id = data.get('system_id')
        if system_id is None:
            return jsonify({'success': False, 'message': 'חסר system_id'}), 400
        last_pt_date = data.get('last_pt_date') or None
        next_check_date = data.get('next_check_date') or None
        system_managers = data.get('system_managers') or None
        sensitivity_level = data.get('sensitivity_level') or None
        status = data.get('status') or 'הכנה'
        tracking_id = db_connection.create_manual_pt_tracking(
            system_id=int(system_id),
            last_pt_date=last_pt_date,
            next_check_date=next_check_date,
            system_managers=system_managers,
            sensitivity_level=sensitivity_level,
            status=status
        )
        if tracking_id is None:
            return jsonify({'success': False, 'message': 'שגיאה ביצירת רשומה (ייתכן שמערכת כבר במעקב)'}), 400
        return jsonify({'success': True, 'id': tracking_id}), 201
    except Exception as e:
        logger.error(f"שגיאה ביצירת מעקב PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500


@app.route('/api/admin/pt-tracking/send-reminders', methods=['POST'])
def admin_pt_tracking_send_reminders():
    """שליחת תזכורות 45 יום לפני תאריך בדיקה - לחוקר סייבר ולמנהלי מערכת (Admin בלבד). מומלץ להפעיל פעם ביום (cron)."""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403

        reminders = db_connection.get_manual_pt_due_reminders()
        if not reminders:
            return jsonify({'success': True, 'message': 'אין מערכות שצריכות תזכורת כרגע', 'sent_count': 0}), 200

        fixed_reminder_email = os.getenv('PT_REMINDER_FIXED_EMAIL', 'asafv@molsa.gov.il').strip()
        researcher_email = os.getenv('CYBER_RESEARCHER_EMAIL', '').strip()
        to_emails = set()
        if fixed_reminder_email:
            to_emails.add(fixed_reminder_email)
        if researcher_email:
            to_emails.add(researcher_email)

        email_pattern = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
        for r in reminders:
            if r.get('system_email'):
                to_emails.add(r['system_email'].strip())
            if r.get('system_managers'):
                for part in re.split(r'[,;\s]+', r['system_managers']):
                    match = email_pattern.search(part)
                    if match:
                        to_emails.add(match.group(0))

        to_emails = [e for e in to_emails if e]
        if not to_emails:
            return jsonify({
                'success': False,
                'message': 'לא נמצאו כתובות לשליחה. הגדר CYBER_RESEARCHER_EMAIL ב-.env או מלא מנהלי מערכת עם אימייל.'
            }), 400

        items_for_email = [
            {
                'system_name': r.get('system_name', ''),
                'next_check_date': r.get('next_check_date', ''),
                'system_managers': r.get('system_managers') or ''
            }
            for r in reminders
        ]
        ok = email_service.send_pt_reminder_email(list(to_emails), items_for_email)
        if not ok:
            return jsonify({'success': False, 'message': 'שגיאה בשליחת המייל'}), 500
        return jsonify({
            'success': True,
            'message': f'נשלחו תזכורות ל-{len(to_emails)} נמענים עבור {len(reminders)} מערכות',
            'sent_count': len(to_emails),
            'systems_count': len(reminders)
        }), 200
    except Exception as e:
        logger.error(f"שגיאה בשליחת תזכורות PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500


@app.route('/api/admin/pt-tracking/<int:tracking_id>', methods=['GET'])
def admin_pt_tracking_get(tracking_id):
    """שליפת רשומת מעקב PT ידני לפי ID (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403
        item = db_connection.get_manual_pt_tracking_by_id(tracking_id)
        if not item:
            return jsonify({'success': False, 'message': 'לא נמצא'}), 404
        return jsonify({'success': True, 'item': item}), 200
    except Exception as e:
        logger.error(f"שגיאה בשליפת מעקב PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500


@app.route('/api/admin/pt-tracking/<int:tracking_id>', methods=['PUT'])
def admin_pt_tracking_update(tracking_id):
    """עדכון רשומת מעקב PT ידני (Admin בלבד). עדכון last_pt_date מפעיל חישוב תאריך בדיקה הבא (+18 חודשים)."""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403
        data = request.get_json() or {}
        system_id = data.get('system_id')
        last_pt_date = data.get('last_pt_date')
        next_check_date = data.get('next_check_date')
        system_managers = data.get('system_managers')
        sensitivity_level = data.get('sensitivity_level')
        status = data.get('status')
        success = db_connection.update_manual_pt_tracking(
            tracking_id,
            system_id=int(system_id) if system_id is not None else None,
            last_pt_date=last_pt_date,
            next_check_date=next_check_date,
            system_managers=system_managers,
            sensitivity_level=sensitivity_level,
            status=status
        )
        if not success:
            return jsonify({'success': False, 'message': 'שגיאה בעדכון'}), 400
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"שגיאה בעדכון מעקב PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500


@app.route('/api/admin/pt-tracking/<int:tracking_id>', methods=['DELETE'])
def admin_pt_tracking_delete(tracking_id):
    """מחיקת רשומת מעקב PT ידני (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({'success': False, 'message': 'אין הרשאה לבצע פעולה זו'}), 403
        success = db_connection.delete_manual_pt_tracking(tracking_id)
        if not success:
            return jsonify({'success': False, 'message': 'שגיאה במחיקה'}), 400
        return jsonify({'success': True}), 200
    except Exception as e:
        logger.error(f"שגיאה במחיקת מעקב PT: {str(e)}")
        return jsonify({'success': False, 'message': 'שגיאה פנימית בשרת', 'error': str(e)}), 500

# רישום כפול של pt-tracking בלי קידומת /api (תאימות לפרוקסי שמקצץ את /api)
app.add_url_rule('/admin/pt-tracking', 'admin_pt_tracking_list_alt', admin_pt_tracking_list, methods=['GET'])
app.add_url_rule('/admin/pt-tracking', 'admin_pt_tracking_create_alt', admin_pt_tracking_create, methods=['POST'])
app.add_url_rule('/admin/pt-tracking/send-reminders', 'admin_pt_tracking_send_reminders_alt', admin_pt_tracking_send_reminders, methods=['POST'])
app.add_url_rule('/admin/pt-tracking/<int:tracking_id>', 'admin_pt_tracking_get_alt', admin_pt_tracking_get, methods=['GET'])
app.add_url_rule('/admin/pt-tracking/<int:tracking_id>', 'admin_pt_tracking_update_alt', admin_pt_tracking_update, methods=['PUT'])
app.add_url_rule('/admin/pt-tracking/<int:tracking_id>', 'admin_pt_tracking_delete_alt', admin_pt_tracking_delete, methods=['DELETE'])


@app.route('/api/admin/users/<int:user_id>/activate', methods=['POST'])
def admin_activate_user(user_id):
    """הפעלת משתמש (Admin בלבד)"""
    try:
        admin_id = require_admin()
        if not admin_id:
            return jsonify({
                'success': False,
                'message': 'אין הרשאה לבצע פעולה זו'
            }), 403
        
        success = db_connection.activate_user(user_id)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'שגיאה בהפעלת משתמש'
            }), 400
        
        logger.info(f"Admin {admin_id} הפעיל משתמש: ID {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'משתמש הופעל בהצלחה'
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בהפעלת משתמש {user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה פנימית בשרת',
            'error': str(e)
        }), 500


# ===============================
# Stitch API Endpoints - ניהול סקריפטי Stitch
# ===============================

@app.route('/api/stitch/scripts', methods=['GET'])
def get_stitch_scripts():
    """שליפת רשימת סקריפטי Stitch זמינים"""
    try:
        logger.info("בקשה לשליפת סקריפטי Stitch")
        
        scripts = stitch_executor.list_available_scripts()
        
        return jsonify({
            'success': True,
            'scripts': scripts,
            'count': len(scripts)
        }), 200
        
    except Exception as e:
        logger.error(f"שגיאה בשליפת סקריפטי Stitch: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'שגיאה בשליפת סקריפטים',
            'error': str(e),
            'scripts': []
        }), 500