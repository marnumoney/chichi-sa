"""Create tables, the admin account, starter training courses and sample jobs (idempotent)."""
import os

from dotenv import load_dotenv

load_dotenv()

from auth import hash_password  # noqa: E402
from database import connect, create_tables  # noqa: E402

COURSES = [
    ('Welcome & how the hub works', 'Applying, getting hired, logging hours and getting paid.',
     'Browse open jobs on the Job Board and apply with a short note about your experience. '
     'When a manager hires you, the job appears under My Work where you log your hours each day. '
     'Approved hours become available balance, which you can withdraw from Earnings.', 8),
    ('Customer support fundamentals', 'Tone, empathy and first-contact resolution.',
     'Greet the customer by name, restate the problem to confirm you understand it, and set clear expectations. '
     'Aim to resolve the issue in one contact; when you cannot, give a specific follow-up time and keep it.', 15),
    ('Data privacy & security basics', 'Handling client and customer data safely.',
     'Only access data you need for the task. Never copy client data to personal devices or share it outside '
     'approved tools. Lock your screen when away and report anything suspicious to your manager immediately.', 12),
    ('Accurate time reporting', 'Logging hours that get approved quickly.',
     'Log time on the day you work it, one entry per job per session. Add a short note describing what you did. '
     'Entries without notes or with round, unexplained totals are more likely to be queried.', 6),
]

JOBS = [
    ('Inbound customer support (chat & email)', 'Northwind Retail', 'Customer Support',
     'Answer customer chats and emails for an online homeware store. Weekday shifts, US hours. '
     'Strong written English and a friendly tone required.', 12.0, 30),
    ('Lead research & data entry', 'Brightpath Solar', 'Data Entry',
     'Find decision-maker contact details for commercial property owners and enter them into our CRM. '
     'Attention to detail matters more than speed.', 9.5, 20),
    ('Appointment setter (outbound calls)', 'Evergreen Dental Group', 'Sales & Lead Gen',
     'Call warm leads and book consultations into the clinic calendar. Script and training provided.', 14.0, 25),
    ('Virtual assistant – inbox & calendar', 'Harbor Legal LLP', 'Virtual Assistance',
     'Manage a partner\'s inbox, schedule meetings across time zones and prepare simple documents.', 15.0, 15),
]


def seed(conn=None):
    own = conn is None
    conn = conn or connect()
    create_tables(conn)

    email = os.getenv('ADMIN_EMAIL', 'admin@example.com').lower()
    password = os.getenv('ADMIN_PASSWORD', 'change-me-now')
    if not conn.execute('SELECT 1 FROM users WHERE email = ?', (email,)).fetchone():
        conn.execute("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, 'Admin', 'admin')",
                     (email, hash_password(password)))
        print(f'Created admin account {email}')

    if conn.execute('SELECT COUNT(*) FROM courses').fetchone()[0] == 0:
        conn.executemany('INSERT INTO courses (title, summary, content, minutes) VALUES (?, ?, ?, ?)', COURSES)
    if conn.execute('SELECT COUNT(*) FROM jobs').fetchone()[0] == 0:
        conn.executemany(
            'INSERT INTO jobs (title, client, category, description, rate, hours_per_week) VALUES (?, ?, ?, ?, ?, ?)',
            JOBS)
    conn.commit()
    if own:
        conn.close()


if __name__ == '__main__':
    seed()
