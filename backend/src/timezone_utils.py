"""
מודול עזר לניהול אזור זמן ישראל

מודול זה מספק פונקציות לעבודה עם זמן באזור זמן ישראל (Asia/Jerusalem).
pytz מטפל אוטומטית בשעון קיץ/חורף.
"""

import pytz
from datetime import datetime

# אזור זמן ישראל
ISRAEL_TZ = pytz.timezone('Asia/Jerusalem')


def get_israel_time():
    """
    מחזיר את הזמן הנוכחי באזור זמן ישראל
    
    Returns:
        datetime: הזמן הנוכחי באזור זמן ישראל (כולל מידע על timezone)
    """
    return datetime.now(ISRAEL_TZ)
