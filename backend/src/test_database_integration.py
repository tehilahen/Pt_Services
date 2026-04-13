#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בדיקות אינטגרציה בסיסיות למסד SQLite (דמו מקומי).
"""
import os
import sys
import logging
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import db_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def _table_exists(name: str) -> bool:
    r = db_connection.execute_query(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? COLLATE NOCASE",
        (name,),
    )
    return bool(r)


class DatabaseIntegrationTester:
    def __init__(self):
        self.db = db_connection

    def run_all_tests(self):
        logger.info("מתחיל בדיקות SQLite")
        tests = [
            self.test_database_connection,
            self.test_core_tables_exist,
            self.test_orphan_vulnerabilities,
        ]
        passed = sum(1 for t in tests if t())
        logger.info("סיום: %s/%s עברו", passed, len(tests))
        return passed == len(tests)

    def test_database_connection(self):
        logger.info("בודק חיבור...")
        return self.db.test_connection()

    def test_core_tables_exist(self):
        logger.info("בודק טבלאות ליבה...")
        required = [
            "Users",
            "Systems",
            "Scans",
            "Vulnerabilities",
            "UsersType",
            "SystemsUsers",
        ]
        for t in required:
            if not _table_exists(t):
                logger.error("חסרה טבלה: %s", t)
                return False
        return True

    def test_orphan_vulnerabilities(self):
        """חולשות שאינן מצביעות על סריקה קיימת."""
        logger.info("בודק מפתחות זרים Vulnerabilities -> Scans...")
        bad = self.db.execute_query(
            """
            SELECT COUNT(*) AS c FROM Vulnerabilities v
            LEFT JOIN Scans s ON v.ScanID = s.ScansID
            WHERE s.ScansID IS NULL
            """
        )
        if bad and bad[0].get("c", 0) > 0:
            logger.error("נמצאו חולשות יתומות: %s", bad[0]["c"])
            return False
        return True


def main():
    if not db_connection.connect():
        print("לא ניתן להתחבר ל-SQLite")
        return False
    ok = DatabaseIntegrationTester().run_all_tests()
    print("הצלחה" if ok else "נכשל")
    return ok


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
