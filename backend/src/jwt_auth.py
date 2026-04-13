"""
מודול אימות JWT - אחראי על יצירה ואימות של JWT tokens
דף זה אחראי על:
- יצירת access tokens למשתמשים מאומתים
- אימות tokens בבקשות נכנסות
- חילוץ מידע משתמש מ-token מאומת
- טיפול בתוקף token ופגיעות אבטחה
"""
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
import logging

logger = logging.getLogger(__name__)

# קונפיגורציה
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', os.getenv('SECRET_KEY', 'change-this-secret-key-in-production'))
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))


def create_access_token(user_id: int, username: str, user_type_id: int, email: str = None, full_name: str = None) -> str:
    """
    יצירת JWT token למשתמש מאומת
    
    Args:
        user_id: מזהה המשתמש
        username: שם המשתמש
        user_type_id: סוג המשתמש (1=Admin, 2=System Manager, 3=Super Manager)
        email: כתובת אימייל (אופציונלי)
        full_name: שם מלא (אופציונלי)
    
    Returns:
        JWT token string
    """
    payload = {
        'user_id': user_id,
        'username': username,
        'user_type_id': user_type_id,
        'email': email,
        'full_name': full_name,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    logger.info(f"נוצר JWT token למשתמש: {username} (ID: {user_id})")
    return token


def decode_token(token: str) -> dict:
    """
    פענוח ואימות JWT token
    
    Args:
        token: ה-JWT token לפענוח
    
    Returns:
        dict עם פרטי המשתמש אם התוקף תקין
        
    Raises:
        jwt.ExpiredSignatureError: אם ה-token פג תוקף
        jwt.InvalidTokenError: אם ה-token לא תקין
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token פג תוקף")
        raise
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT token לא תקין: {str(e)}")
        raise


def get_token_from_request():
    """
    חילוץ JWT token מבקשה
    
    מחפש את ה-token ב:
    1. Authorization header (Bearer token)
    2. X-Access-Token header
    
    Returns:
        str: ה-token או None אם לא נמצא
    """
    # בדיקת Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    
    # בדיקת X-Access-Token header
    access_token = request.headers.get('X-Access-Token')
    if access_token:
        return access_token
    
    return None


def jwt_required(f):
    """
    Decorator שדורש JWT token תקין לגישה ל-endpoint
    
    מוסיף לפונקציה את הפרמטרים:
    - current_user: dict עם פרטי המשתמש המאומת
    
    שימוש:
        @app.route('/api/protected')
        @jwt_required
        def protected_route(current_user):
            return f"Hello {current_user['username']}"
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        
        if not token:
            return jsonify({
                'success': False,
                'message': 'נדרש אימות - חסר token',
                'error': 'Missing authentication token'
            }), 401
        
        try:
            current_user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'ה-token פג תוקף - יש להתחבר מחדש',
                'error': 'Token expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'token לא תקין',
                'error': 'Invalid token'
            }), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated


def jwt_optional(f):
    """
    Decorator שמנסה לאמת JWT token אך לא דורש אותו
    
    שימושי עבור endpoints שמציגים תוכן שונה למשתמשים מאומתים
    
    מוסיף לפונקציה את הפרמטר:
    - current_user: dict עם פרטי המשתמש או None
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        current_user = None
        
        if token:
            try:
                current_user = decode_token(token)
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                # Token לא תקין - ממשיכים ללא אימות
                pass
        
        return f(current_user, *args, **kwargs)
    
    return decorated


def admin_required(f):
    """
    Decorator שדורש JWT token תקין של Admin (UserTypeID = 1)
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        
        if not token:
            return jsonify({
                'success': False,
                'message': 'נדרש אימות - חסר token',
                'error': 'Missing authentication token'
            }), 401
        
        try:
            current_user = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'ה-token פג תוקף - יש להתחבר מחדש',
                'error': 'Token expired'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'token לא תקין',
                'error': 'Invalid token'
            }), 401
        
        # בדיקת הרשאת Admin
        if current_user.get('user_type_id') != 1:
            return jsonify({
                'success': False,
                'message': 'אין הרשאת מנהל לפעולה זו',
                'error': 'Admin permission required'
            }), 403
        
        return f(current_user, *args, **kwargs)
    
    return decorated

