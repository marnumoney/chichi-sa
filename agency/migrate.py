"""One-time migration: copy leads, emails, replies from lead-agent/leads.db into agency.db."""
import sqlite3
import sys

SOURCE = "/home/marnu/lead-agent/leads.db"
DEST = "/home/marnu/agency/data/agency.db"


def migrate():
    src = sqlite3.connect(SOURCE)
    src.row_factory = sqlite3.Row

    sys.path.insert(0, "/home/marnu/agency")
    from shared.db import init_db
    dst = init_db(DEST)

    # Migrate leads
    leads = src.execute("SELECT * FROM leads").fetchall()
    for row in leads:
        try:
            dst.execute(
                """INSERT OR IGNORE INTO leads
                   (place_id, business_name, industry, city, phone, email, rating, review_count, found_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (row["place_id"], row["business_name"], row["industry"], row["city"],
                 row["phone"], row["email"], row["rating"], row["review_count"], row["found_date"]))
        except Exception as e:
            print(f"Lead skip: {e}")

    dst.commit()

    # Build place_id → new_id mapping
    old_ids = {r[0]: r[1] for r in dst.execute("SELECT place_id, id FROM leads").fetchall()}
    src_leads = {r[0]: r[1] for r in src.execute("SELECT id, place_id FROM leads").fetchall()}

    # Migrate emails
    emails = src.execute("SELECT * FROM emails").fetchall()
    for row in emails:
        pid = src_leads.get(row["lead_id"])
        new_lid = old_ids.get(pid)
        if not new_lid:
            continue
        try:
            # follow_up_number column may not exist in old db — default 0
            try:
                fup = row["follow_up_number"]
            except Exception:
                fup = 0
            dst.execute(
                """INSERT OR IGNORE INTO emails
                   (lead_id, sent_at, status, subject, body, outlook_message_id, follow_up_number)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (new_lid, row["sent_at"], row["status"], row["subject"], row["body"],
                 row["outlook_message_id"], fup))
        except Exception as e:
            print(f"Email skip: {e}")

    dst.commit()

    # Migrate replies (if table exists in source)
    try:
        replies = src.execute("SELECT * FROM replies").fetchall()
        for row in replies:
            pid = src_leads.get(row["lead_id"])
            new_lid = old_ids.get(pid)
            if not new_lid:
                continue
            try:
                dst.execute(
                    """INSERT OR IGNORE INTO replies
                       (lead_id, from_email, subject, body, received_at, gmail_uid, notified)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (new_lid, row["from_email"], row["subject"], row["body"],
                     row["received_at"], row["gmail_uid"], row.get("notified", 0) if hasattr(row, "keys") else 0))
            except Exception as e:
                print(f"Reply skip: {e}")
        dst.commit()
    except Exception as e:
        print(f"Replies migration skipped: {e}")

    src.close()
    dst.close()

    result = sqlite3.connect(DEST).execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    print(f"Migration complete. {result} leads in agency.db")


if __name__ == "__main__":
    migrate()
