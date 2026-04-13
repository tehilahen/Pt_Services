"""
שירות שליחת מיילים - אחראי על כל שליחות המיילים במערכת
דף זה אחראי על:
- שליחת מיילי איפוס סיסמה עם טוקן
- שליחת בקשות סריקה למנהל המערכת
- שליחת מיילים כלליים
- תמיכה ב-SMTP עם/בלי אימות, TLS/SSL
- עיצוב מיילים ב-HTML עם תמיכה בעברית
- שימוש בתבניות Jinja2 חיצוניות
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime
from dotenv import load_dotenv
import logging
from jinja2 import Environment, FileSystemLoader, select_autoescape

load_dotenv()
logger = logging.getLogger(__name__)

# הגדרת Jinja2 לתבניות מייל
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates', 'email')
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)

class EmailService:
    def __init__(self):
        # אפשרות 1: שרת SMTP פנימי (ללא אימות או עם אימות מינימלי)
        # אפשרות 2: שרת Exchange פנימי
        # אפשרות 3: Office 365 עם אימות
        
        self.smtp_server = os.getenv('SMTP_SERVER', 'localhost')  # ברירת מחדל לשרת מקומי
        self.smtp_port = int(os.getenv('SMTP_PORT', '25'))  # פורט 25 לשרת פנימי
        self.smtp_username = os.getenv('SMTP_USERNAME', '')  # ריק = ללא אימות
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')  # ריק = ללא אימות
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@molsa.gov.il')
        self.from_name = os.getenv('FROM_NAME', 'מערכת Security Scans')
        self.use_tls = os.getenv('SMTP_USE_TLS', 'False').lower() == 'true'
        self.require_auth = os.getenv('SMTP_REQUIRE_AUTH', 'False').lower() == 'true'
        
    def send_password_reset_email(self, to_email, reset_token, username):
        """
        שליחת מייל עם קוד איפוס סיסמה - משתמש בתבניות Jinja2 חיצוניות
        
        Args:
            to_email: כתובת האימייל של הנמען
            reset_token: הטוקן לאיפוס הסיסמה
            username: שם המשתמש
        
        Returns:
            bool: True אם השליחה הצליחה, False אחרת
        """
        try:
            # יצירת ההודעה
            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'איפוס סיסמה - מערכת Security Scans'
            msg['From'] = f'{self.from_name} <{self.from_email}>'
            msg['To'] = to_email
            
            # נתונים לתבנית
            template_data = {
                'username': username,
                'reset_token': reset_token
            }
            
            # רנדור תבניות Jinja2
            try:
                text_template = jinja_env.get_template('password_reset.txt')
                html_template = jinja_env.get_template('password_reset.html')
                text_content = text_template.render(**template_data)
                html_content = html_template.render(**template_data)
            except Exception as template_error:
                logger.warning(f"שגיאה בטעינת תבניות, משתמש בתבניות fallback: {template_error}")
                # Fallback לתבניות inline
                text_content = f"""שלום {username},

קיבלנו בקשה לאיפוס הסיסמה שלך במערכת Security Scans.
קוד האיפוס שלך הוא: {reset_token}
הקוד תקף ל-24 שעות.

בברכה, צוות Security Scans"""
                html_content = text_content
            
            # הוספת שני הגרסאות להודעה
            part1 = MIMEText(text_content, 'plain', 'utf-8')
            part2 = MIMEText(html_content, 'html', 'utf-8')
            
            msg.attach(part1)
            msg.attach(part2)
            
            # שליחת המייל
            logger.info(f"מתחבר לשרת SMTP: {self.smtp_server}:{self.smtp_port}")
            logger.info(f"שולח מ-{self.from_email} ל-{to_email}")
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                server.set_debuglevel(1)  # הצגת debug למעקב
                
                # אם נדרש TLS
                if self.use_tls:
                    logger.info("משתמש ב-TLS")
                    server.starttls()
                
                # אם נדרש אימות
                if self.require_auth and self.smtp_username and self.smtp_password:
                    logger.info(f"מתחבר עם משתמש: {self.smtp_username}")
                    server.login(self.smtp_username, self.smtp_password)
                else:
                    logger.info("שולח ללא אימות (שרת פנימי)")
                
                server.send_message(msg)
                logger.info(f"✓ מייל נשלח בהצלחה ל-{to_email}")
                
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"שגיאת אימות SMTP: {str(e)}")
            logger.error("בדוק את שם המשתמש והסיסמה ב-.env")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"שגיאת SMTP: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"שגיאה בשליחת מייל: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def send_scan_request_email(self, requester_name, requester_email, requester_phone, 
                                system_name, system_url, details):
        """
        שליחת בקשה לבדיקת מערכת - משתמש בתבניות Jinja2 חיצוניות
        
        Args:
            requester_name: שם הפונה
            requester_email: אימייל הפונה
            requester_phone: טלפון הפונה
            system_name: שם המערכת
            system_url: כתובת המערכת
            details: פרטים נוספים
        
        Returns:
            bool: True אם השליחה הצליחה, False אחרת
        """
        try:
            # כתובת הנמען
            to_email = os.getenv('SCAN_REQUEST_EMAIL', 'AsafV@molsa.gov.il')
            
            # יצירת ההודעה
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f'🔒 בקשה לבדיקת אבטחה - {system_name}'
            msg['From'] = f'{self.from_name} <{self.from_email}>'
            msg['To'] = to_email
            if requester_email:
                msg['Reply-To'] = requester_email
            
            # נתונים לתבנית
            template_data = {
                'requester_name': requester_name,
                'requester_email': requester_email,
                'requester_phone': requester_phone,
                'system_name': system_name,
                'system_url': system_url,
                'details': details,
                'current_datetime': datetime.now().strftime('%d/%m/%Y %H:%M')
            }
            
            # רנדור תבניות Jinja2
            try:
                text_template = jinja_env.get_template('scan_request.txt')
                html_template = jinja_env.get_template('scan_request.html')
                text_content = text_template.render(**template_data)
                html_content = html_template.render(**template_data)
            except Exception as template_error:
                logger.warning(f"שגיאה בטעינת תבניות, משתמש בתבניות fallback: {template_error}")
                # Fallback לתבניות inline
                text_content = f"""בקשה לבדיקת אבטחה
שם: {requester_name}
מייל: {requester_email or 'לא צוין'}
מערכת: {system_name}
URL: {system_url or 'לא צוין'}
פרטים: {details or 'אין'}"""
                html_content = text_content
            
            # הוספת שני הגרסאות להודעה
            part1 = MIMEText(text_content, 'plain', 'utf-8')
            part2 = MIMEText(html_content, 'html', 'utf-8')
            
            msg.attach(part1)
            msg.attach(part2)
            
            # שליחת המייל
            logger.info(f"שולח בקשת סריקה מ-{self.from_email} ל-{to_email}")
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                server.set_debuglevel(0)  # ללא debug לשליחות רגילות
                
                if self.use_tls:
                    server.starttls()
                
                if self.require_auth and self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                
                server.send_message(msg)
                logger.info(f"✓ בקשת סריקה נשלחה בהצלחה ל-{to_email}")
                
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בשליחת בקשת סריקה: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def send_pt_reminder_email(self, to_emails, items):
        """
        שליחת תזכורת בדיקת PT ידני - 45 יום לפני תאריך הבדיקה.
        to_emails: רשימת כתובות (חוקר סייבר + מנהלי מערכת)
        items: רשימת dict עם system_name, next_check_date, system_managers
        """
        if not items or not to_emails:
            logger.warning("send_pt_reminder_email: אין נמענים או אין פריטים")
            return True
        try:
            template_data = {
                'items': items,
                'current_datetime': datetime.now().strftime('%d/%m/%Y %H:%M')
            }
            try:
                text_template = jinja_env.get_template('pt_reminder.txt')
                html_template = jinja_env.get_template('pt_reminder.html')
                text_content = text_template.render(**template_data)
                html_content = html_template.render(**template_data)
            except Exception as template_error:
                logger.warning(f"תבנית תזכורת PT: {template_error}")
                text_content = "תזכורת בדיקת PT: " + ", ".join(i.get('system_name', '') for i in items)
                html_content = text_content

            msg = MIMEMultipart('alternative')
            msg['Subject'] = 'תזכורת: בדיקת חוסן (PT) מתוכננת - מערכת מעקב PT ידני'
            msg['From'] = f'{self.from_name} <{self.from_email}>'
            msg['To'] = ', '.join(to_emails)

            part1 = MIMEText(text_content, 'plain', 'utf-8')
            part2 = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                if self.use_tls:
                    server.starttls()
                if self.require_auth and self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                server.sendmail(self.from_email, to_emails, msg.as_string())
            logger.info(f"✓ תזכורת PT נשלחה ל-{len(to_emails)} נמענים, {len(items)} מערכות")
            return True
        except Exception as e:
            logger.error(f"שגיאה בשליחת תזכורת PT: {str(e)}")
            return False

    def send_email(self, to_email, subject, body):
        """
        שליחת מייל כללי
        
        Args:
            to_email: כתובת האימייל של הנמען
            subject: נושא המייל
            body: תוכן המייל
        
        Returns:
            bool: True אם השליחה הצליחה, False אחרת
        """
        try:
            # יצירת ההודעה
            msg = MIMEText(body, 'plain', 'utf-8')
            msg['Subject'] = subject
            msg['From'] = f'{self.from_name} <{self.from_email}>'
            msg['To'] = to_email
            
            # שליחת המייל
            logger.info(f"שולח מייל מ-{self.from_email} ל-{to_email}")
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30) as server:
                if self.use_tls:
                    server.starttls()
                
                if self.require_auth and self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                
                server.send_message(msg)
                logger.info(f"✓ מייל נשלח בהצלחה ל-{to_email}")
                
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בשליחת מייל: {str(e)}")
            return False

    def test_connection(self):
        """בדיקת חיבור לשרת SMTP"""
        try:
            logger.info(f"בודק חיבור ל-{self.smtp_server}:{self.smtp_port}")
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                if self.use_tls:
                    server.starttls()
                
                if self.require_auth and self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)
                    logger.info("חיבור והתחברות הצליחו!")
                else:
                    logger.info("חיבור הצליח (ללא אימות)")
                
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בבדיקת חיבור: {str(e)}")
            return False

# יצירת מופע גלובלי
email_service = EmailService()

