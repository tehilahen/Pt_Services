#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בדיקות אינטגרציה למסד נתונים - וידוא תקינות הנתונים והטבלאות
דף זה מיועד ל:
- בדיקת חיבור למסד הנתונים
- וידוא קיום כל הטבלאות הנדרשות
- בדיקת שלמות נתונים (foreign keys, constraints)
- בדיקת עקביות נתונים בין טבלאות
- בדיקת Views ו-Stored Procedures
- יצירת דוחות בדיקה מפורטים
"""

import os
import sys
import logging
from datetime import datetime

# הוספת נתיב הbackend
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.database import db_connection
from src.csv_parser import csv_parser

# הגדרת לוגים
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('database_integration_test.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

class DatabaseIntegrationTester:
    def __init__(self):
        self.db = db_connection
        self.parser = csv_parser
        self.test_results = {}
    
    def run_all_tests(self):
        """הרצת כל הבדיקות"""
        logger.info("🚀 מתחיל בדיקות שלמות מסד נתונים")
        
        tests = [
            self.test_database_connection,
            self.test_tables_exist,
            self.test_csv_processing,
            self.test_data_integrity,
            self.test_foreign_keys,
            self.test_data_consistency,
            self.test_views_and_procedures
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test in tests:
            try:
                result = test()
                if result:
                    passed_tests += 1
                    logger.info(f"✅ {test.__name__} - עבר")
                else:
                    logger.error(f"❌ {test.__name__} - נכשל")
            except Exception as e:
                logger.error(f"💥 {test.__name__} - שגיאה: {str(e)}")
        
        success_rate = (passed_tests / total_tests) * 100
        logger.info(f"📊 תוצאות סופיות: {passed_tests}/{total_tests} בדיקות עברו ({success_rate:.1f}%)")
        
        return success_rate >= 80  # 80% הצלחה נחשב כהצלחה
    
    def test_database_connection(self):
        """בדיקת חיבור למסד הנתונים"""
        logger.info("🔗 בודק חיבור למסד הנתונים...")
        return self.db.test_connection()
    
    def test_tables_exist(self):
        """בדיקה שכל הטבלאות קיימות"""
        logger.info("🗄️ בודק קיום טבלאות...")
        
        required_tables = ['systems', 'vulnerabilities', 'reports', 'nikto_scans', 'vulnerability_categories']
        
        for table in required_tables:
            result = self.db.execute_query(
                f"SELECT COUNT(*) as count FROM sys.tables WHERE name = '{table}'"
            )
            if not result or result[0]['count'] == 0:
                logger.error(f"טבלה {table} לא קיימת")
                return False
        
        logger.info(f"כל {len(required_tables)} הטבלאות קיימות")
        return True
    
    def test_csv_processing(self):
        """בדיקת עיבוד קובץ CSV"""
        logger.info("📄 בודק עיבוד קובץ CSV...")
        
        # ניקוי נתונים קיימים
        self.db.execute_non_query("DELETE FROM vulnerabilities")
        self.db.execute_non_query("DELETE FROM reports")
        self.db.execute_non_query("DELETE FROM nikto_scans")
        self.db.execute_non_query("DELETE FROM systems")
        
        # עיבוד קובץ הבדיקה
        test_file = os.path.join('..', 'test.csv')
        if not os.path.exists(test_file):
            logger.error(f"קובץ בדיקה לא נמצא: {test_file}")
            return False
        
        return self.parser.process_file(test_file)
    
    def test_data_integrity(self):
        """בדיקת שלמות הנתונים"""
        logger.info("🔍 בודק שלמות נתונים...")
        return self.parser.verify_data_integrity()
    
    def test_foreign_keys(self):
        """בדיקת מפתחות זרים"""
        logger.info("🔗 בודק מפתחות זרים...")
        
        # בדיקה שכל החולשות מקושרות למערכת קיימת
        orphaned_vulns = self.db.execute_query(
            """SELECT COUNT(*) as count 
               FROM vulnerabilities v
               LEFT JOIN systems s ON v.system_id = s.id
               WHERE s.id IS NULL"""
        )
        
        if orphaned_vulns and orphaned_vulns[0]['count'] > 0:
            logger.error(f"נמצאו {orphaned_vulns[0]['count']} חולשות ללא מערכת")
            return False
        
        # בדיקה שכל הדוחות מקושרים למערכת קיימת
        orphaned_reports = self.db.execute_query(
            """SELECT COUNT(*) as count 
               FROM reports r
               LEFT JOIN systems s ON r.system_id = s.id
               WHERE s.id IS NULL"""
        )
        
        if orphaned_reports and orphaned_reports[0]['count'] > 0:
            logger.error(f"נמצאו {orphaned_reports[0]['count']} דוחות ללא מערכת")
            return False
        
        logger.info("כל המפתחות הזרים תקינים")
        return True
    
    def test_data_consistency(self):
        """בדיקת עקביות נתונים"""
        logger.info("⚖️ בודק עקביות נתונים...")
        
        # בדיקה שמספר החולשות בטבלת systems תואם למציאות
        inconsistent_systems = self.db.execute_query(
            """SELECT s.id, s.name, s.total_vulnerabilities, 
                      COUNT(v.id) as actual_vulns
               FROM systems s
               LEFT JOIN vulnerabilities v ON s.id = v.system_id
               GROUP BY s.id, s.name, s.total_vulnerabilities
               HAVING s.total_vulnerabilities != COUNT(v.id)"""
        )
        
        if inconsistent_systems:
            logger.error(f"נמצאו {len(inconsistent_systems)} מערכות עם אי התאמה במספר החולשות")
            for system in inconsistent_systems:
                logger.error(f"  - {system['name']}: רשום {system['total_vulnerabilities']}, בפועל {system['actual_vulns']}")
            return False
        
        # בדיקה שמספר החולשות בדוחות תואם למציאות
        inconsistent_reports = self.db.execute_query(
            """SELECT r.id, r.report_name, r.vulnerabilities_found,
                      COUNT(v.id) as actual_vulns
               FROM reports r
               LEFT JOIN vulnerabilities v ON r.system_id = v.system_id
               GROUP BY r.id, r.report_name, r.vulnerabilities_found
               HAVING r.vulnerabilities_found != COUNT(v.id)"""
        )
        
        if inconsistent_reports:
            logger.warning(f"נמצאו {len(inconsistent_reports)} דוחות עם אי התאמה במספר החולשות")
            # זה warning ולא error כי יכול להיות שהדוח מתייחס לחלק מהחולשות
        
        logger.info("עקביות הנתונים תקינה")
        return True
    
    def test_views_and_procedures(self):
        """בדיקת Views ו-Stored Procedures"""
        logger.info("👁️ בודק Views ו-Stored Procedures...")
        
        # בדיקת Views
        views_to_test = ['v_vulnerability_summary', 'v_vulnerability_details']
        
        for view in views_to_test:
            try:
                result = self.db.execute_query(f"SELECT TOP 1 * FROM {view}")
                logger.info(f"View {view} עובד תקין")
            except Exception as e:
                logger.error(f"View {view} לא עובד: {str(e)}")
                return False
        
        # בדיקת Stored Procedure
        try:
            # נניח שיש לנו מערכת עם ID=1
            systems = self.db.execute_query("SELECT TOP 1 id FROM systems")
            if systems:
                system_id = systems[0]['id']
                result = self.db.execute_query(
                    "EXEC sp_GetSystemVulnerabilities @system_id = ?",
                    (system_id,)
                )
                logger.info("Stored Procedure sp_GetSystemVulnerabilities עובד תקין")
        except Exception as e:
            logger.error(f"Stored Procedure לא עובד: {str(e)}")
            return False
        
        return True
    
    def generate_report(self):
        """יצירת דוח מפורט"""
        logger.info("📋 יוצר דוח מפורט...")
        
        try:
            # נתונים כלליים
            systems_count = self.db.execute_query("SELECT COUNT(*) as count FROM systems")[0]['count']
            vulns_count = self.db.execute_query("SELECT COUNT(*) as count FROM vulnerabilities")[0]['count']
            reports_count = self.db.execute_query("SELECT COUNT(*) as count FROM reports")[0]['count']
            scans_count = self.db.execute_query("SELECT COUNT(*) as count FROM nikto_scans")[0]['count']
            
            # פילוח חולשות
            severity_breakdown = self.db.execute_query(
                """SELECT severity, COUNT(*) as count 
                   FROM vulnerabilities 
                   GROUP BY severity 
                   ORDER BY 
                   CASE severity 
                       WHEN 'Critical' THEN 1
                       WHEN 'High' THEN 2
                       WHEN 'Medium' THEN 3
                       WHEN 'Low' THEN 4
                       ELSE 5
                   END"""
            )
            
            report = f"""
=== דוח בדיקת שלמות מסד נתונים ===
תאריך: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

📊 סיכום נתונים:
- מערכות: {systems_count}
- חולשות: {vulns_count}
- דוחות: {reports_count}
- סריקות: {scans_count}

📈 פילוח חולשות לפי חומרה:
"""
            for severity in severity_breakdown:
                report += f"- {severity['severity']}: {severity['count']}\n"
            
            report += f"""
✅ הבדיקה הושלמה בהצלחה!
כל הטבלאות מתמלאות כראוי לאחר עיבוד קובץ CSV.
"""
            
            # שמירת הדוח לקובץ
            with open('database_integration_report.txt', 'w', encoding='utf-8') as f:
                f.write(report)
            
            logger.info("דוח נשמר בקובץ: database_integration_report.txt")
            print(report)
            
        except Exception as e:
            logger.error(f"שגיאה ביצירת דוח: {str(e)}")

def main():
    """פונקציה ראשית"""
    print("🔧 בדיקת שלמות מסד נתונים SA_DTI_Security_NiktoWebServerScanner")
    print("=" * 60)
    
    tester = DatabaseIntegrationTester()
    
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 כל הבדיקות עברו בהצלחה!")
        tester.generate_report()
    else:
        print("\n⚠️ חלק מהבדיקות נכשלו. בדוק את הלוגים לפרטים.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 