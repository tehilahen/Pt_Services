#!/usr/bin/env python3
"""
מנהל ביצוע סקריפטי Stitch - אחראי על הפעלה ועיבוד תוצאות

דף זה אחראי על:
- הפעלת סקריפטי Python מותאמים אישית באופן אסינכרוני
- ניהול ביצוע הסקריפטים עם timeout
- עיבוד תוצאות JSON מהסקריפטים
- עדכון סטטוס סריקות במסד הנתונים
- הוספת חולשות שנמצאו למסד הנתונים
"""

import subprocess
import os
import logging
import threading
import json
import tempfile
from datetime import datetime
from pathlib import Path
from src.database import db_connection
from src.timezone_utils import get_israel_time

# הגדרת לוגים
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(threadName)s] [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class StitchExecutor:
    """מנהל ביצוע סקריפטי Stitch"""
    
    def __init__(self):
        # נתיב לתיקיית הסקריפטים
        self.scripts_dir = Path(__file__).parent / 'scripts'
        self.python_path = os.getenv('PYTHON_PATH', 'python')
        self.scan_timeout = int(os.getenv('STITCH_TIMEOUT', '600'))  # 10 minutes default
        
        logger.info(f"Stitch scripts directory: {self.scripts_dir}")
        logger.info(f"Python path: {self.python_path}")
        logger.info(f"Scan timeout: {self.scan_timeout} seconds")
    
    def list_available_scripts(self):
        """
        שליפת רשימת סקריפטים זמינים
        
        Returns:
            list: רשימת סקריפטים עם פרטים
        """
        scripts = []
        
        try:
            if not self.scripts_dir.exists():
                logger.warning(f"Scripts directory does not exist: {self.scripts_dir}")
                return scripts
            
            for script_file in self.scripts_dir.glob('*.py'):
                # דלג על __init__.py
                if script_file.name == '__init__.py':
                    continue
                
                # קריאת תיאור הסקריפט מה-docstring
                description = self._get_script_description(script_file)
                
                scripts.append({
                    'name': script_file.stem,
                    'filename': script_file.name,
                    'path': str(script_file),
                    'description': description
                })
            
            logger.info(f"Found {len(scripts)} Stitch scripts")
            return scripts
            
        except Exception as e:
            logger.error(f"Error listing scripts: {str(e)}")
            return []
    
    def _get_script_description(self, script_path):
        """
        חילוץ תיאור מה-docstring של הסקריפט
        
        Args:
            script_path: נתיב לסקריפט
            
        Returns:
            str: תיאור הסקריפט
        """
        try:
            with open(script_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
                # חיפוש docstring
                in_docstring = False
                docstring_lines = []
                
                for line in lines[:50]:  # בדוק רק את 50 השורות הראשונות
                    if '"""' in line or "'''" in line:
                        if in_docstring:
                            break
                        in_docstring = True
                        # הוסף את הטקסט באותה שורה
                        text = line.split('"""')[1] if '"""' in line else line.split("'''")[1]
                        if text.strip():
                            docstring_lines.append(text.strip())
                        continue
                    
                    if in_docstring:
                        docstring_lines.append(line.strip())
                
                if docstring_lines:
                    # קח את השורה הראשונה כתיאור
                    return docstring_lines[0] if docstring_lines[0] else 'No description'
                
        except Exception as e:
            logger.warning(f"Could not read script description from {script_path}: {str(e)}")
        
        return 'No description available'
    
    def execute_scan_async(self, system_id, scan_id, script_name='example_scan'):
        """
        הפעלת סריקה אסינכרונית (ב-thread נפרד)
        
        Args:
            system_id: מזהה המערכת לסריקה
            scan_id: מזהה הסריקה במסד הנתונים
            script_name: שם הסקריפט להרצה (ללא .py)
            
        Returns:
            threading.Thread: ה-thread שמריץ את הסריקה
        """
        thread = threading.Thread(
            target=self._execute_scan,
            args=(system_id, scan_id, script_name),
            name=f'Stitch-{scan_id}'
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"Started Stitch scan thread for scan_id={scan_id}, system_id={system_id}, script={script_name}")
        return thread
    
    def _execute_scan(self, system_id, scan_id, script_name):
        """
        ביצוע הסריקה בפועל (מופעל ב-thread)
        
        Args:
            system_id: מזהה המערכת
            scan_id: מזהה הסריקה
            script_name: שם הסקריפט
        """
        start_time = get_israel_time()
        
        try:
            logger.info(f"[Scan {scan_id}] Starting Stitch scan - SystemID: {system_id}, Script: {script_name}")
            
            # עדכון סטטוס ל-running
            db_connection.update_scan_status(scan_id, 'running', start_date=start_time)
            
            # שליפת פרטי המערכת
            system_info = db_connection.get_system_url(system_id)
            if not system_info:
                raise Exception(f"System {system_id} not found")
            
            target_url = system_info.get('URL')
            if not target_url:
                raise Exception(f"System {system_id} has no URL configured")
            
            logger.info(f"[Scan {scan_id}] Target URL: {target_url}")
            
            # הרצת הסקריפט
            results = self._run_script(script_name, target_url, scan_id)
            
            # עיבוד התוצאות
            if results:
                self._process_results(results, system_id, scan_id)
                
                end_time = get_israel_time()
                duration = int((end_time - start_time).total_seconds())
                
                # עדכון סטטוס להצלחה
                db_connection.update_scan_status(
                    scan_id,
                    'completed',
                    start_date=start_time,
                    end_date=end_time
                )
                
                # עדכון Duration
                db_connection.execute_non_query(
                    "UPDATE Scans SET Duration = ? WHERE ScansID = ?",
                    (duration, scan_id)
                )
                
                logger.info(f"[Scan {scan_id}] Completed successfully - Duration: {duration}s, Vulnerabilities: {len(results.get('vulnerabilities', []))}")
            else:
                raise Exception("No results returned from script")
                
        except subprocess.TimeoutExpired:
            logger.error(f"[Scan {scan_id}] Timeout after {self.scan_timeout} seconds")
            db_connection.update_scan_status(scan_id, 'failed', start_date=start_time, end_date=get_israel_time())
            
        except Exception as e:
            logger.error(f"[Scan {scan_id}] Error: {str(e)}")
            db_connection.update_scan_status(scan_id, 'failed', start_date=start_time, end_date=get_israel_time())
    
    def _run_script(self, script_name, target_url, scan_id):
        """
        הרצת סקריפט ספציפי
        
        Args:
            script_name: שם הסקריפט
            target_url: כתובת היעד
            scan_id: מזהה הסריקה
            
        Returns:
            dict: תוצאות הסריקה (JSON)
        """
        script_path = self.scripts_dir / f"{script_name}.py"
        
        if not script_path.exists():
            raise FileNotFoundError(f"Script not found: {script_path}")
        
        # בניית הפקודה
        command = [
            self.python_path,
            str(script_path),
            '--target', target_url,
            '--timeout', str(self.scan_timeout)
        ]
        
        logger.info(f"[Scan {scan_id}] Running command: {' '.join(command)}")
        
        try:
            # הרצת הסקריפט
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=self.scan_timeout,
                check=False  # לא נזרוק exception על exit code != 0
            )
            
            logger.info(f"[Scan {scan_id}] Script exit code: {result.returncode}")
            
            if result.returncode != 0:
                logger.warning(f"[Scan {scan_id}] Script stderr: {result.stderr}")
            
            # ניתוח הפלט JSON
            if result.stdout:
                try:
                    json_output = json.loads(result.stdout)
                    logger.info(f"[Scan {scan_id}] Successfully parsed JSON output")
                    return json_output
                except json.JSONDecodeError as e:
                    logger.error(f"[Scan {scan_id}] Failed to parse JSON output: {str(e)}")
                    logger.error(f"[Scan {scan_id}] Output was: {result.stdout[:500]}")
                    raise Exception(f"Invalid JSON output from script: {str(e)}")
            else:
                raise Exception("No output from script")
                
        except subprocess.TimeoutExpired:
            logger.error(f"[Scan {scan_id}] Script timeout after {self.scan_timeout} seconds")
            raise
        except Exception as e:
            logger.error(f"[Scan {scan_id}] Error running script: {str(e)}")
            raise
    
    def _process_results(self, results, system_id, scan_id):
        """
        עיבוד תוצאות הסריקה והכנסה למסד הנתונים
        
        Args:
            results: תוצאות הסריקה (dict)
            system_id: מזהה המערכת
            scan_id: מזהה הסריקה
        """
        try:
            vulnerabilities = results.get('vulnerabilities', [])
            
            logger.info(f"[Scan {scan_id}] Processing {len(vulnerabilities)} vulnerabilities")
            
            for vuln in vulnerabilities:
                # הכנת הנתונים להכנסה
                description = vuln.get('description', 'No description')
                severity = vuln.get('severity', 'Low')
                cvss = vuln.get('cvss')
                cve = vuln.get('cve')
                references = vuln.get('references', '')
                
                # וולידציה של severity
                valid_severities = ['Critical', 'High', 'Medium', 'Low']
                if severity not in valid_severities:
                    logger.warning(f"Invalid severity '{severity}', defaulting to 'Low'")
                    severity = 'Low'
                
                # הכנסת החולשה למסד הנתונים
                try:
                    db_connection.execute_non_query("""
                        INSERT INTO Vulnerabilities (ScanID, Description, [References], CVSS, CVE, Severity)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (scan_id, description, references, cvss, cve, severity))
                    
                except Exception as e:
                    logger.error(f"[Scan {scan_id}] Error inserting vulnerability: {str(e)}")
                    continue
            
            logger.info(f"[Scan {scan_id}] Successfully inserted {len(vulnerabilities)} vulnerabilities")
            
        except Exception as e:
            logger.error(f"[Scan {scan_id}] Error processing results: {str(e)}")
            raise


# יצירת מופע גלובלי
stitch_executor = StitchExecutor()
