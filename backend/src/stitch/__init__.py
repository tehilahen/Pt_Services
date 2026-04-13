"""
מודול Stitch - סקריפטי בדיקות אבטחה מותאמים אישית

מודול זה מאפשר הרצת סקריפטי Python מותאמים אישית לביצוע בדיקות אבטחה
על מערכות שונות, לצד סריקות Nikto הסטנדרטיות.

דוגמאות שימוש:
    from src.stitch import stitch_executor
    
    # הרצת סריקה אסינכרונית
    thread = stitch_executor.execute_scan_async(system_id, scan_id)
    
    # קבלת רשימת סקריפטים זמינים
    scripts = stitch_executor.list_available_scripts()
"""
from .stitch_executor import stitch_executor

__all__ = ['stitch_executor']
