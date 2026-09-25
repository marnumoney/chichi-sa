# Freelancer Hub

A portal for remote BPO freelancers (support, data entry, sales, virtual assistance) and the managers who hire them.

**Freelancers** sign up, build a profile, complete onboarding training, browse and apply to jobs, log daily hours
on jobs they're hired for, track earnings and request payouts.
**Admins** post and manage jobs, hire or reject applicants, approve or reject timesheets, process payouts,
view all freelancers and manage training modules. Every decision sends the freelancer a notification.

Stack: FastAPI + SQLite backend, dependency-free vanilla JS single-page frontend (served by the same app).

## Run locally

```bash
cd freelancer-hub
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' python seed.py   # tables, admin, starter jobs & training
SECRET_KEY='long-random-string' uvicorn main:app --reload
```

Open http://localhost:8000, log in with the admin account, or sign up as a freelancer.

| Env var | Purpose | Default |
| --- | --- | --- |
| `SECRET_KEY` | Signs login tokens — **set this in production** | insecure dev value (warns) |
| `DB_PATH` | SQLite file location | `freelancer_hub.db` next to the code |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin account created by `seed.py` | `admin@example.com` / `change-me-now` |

## Business rules

- Time can only be logged on jobs you were hired for, not in the future, max 24h per day across all jobs.
- Hours are billed at the job's rate *when logged*; later rate changes don't rewrite history.
- Only approved hours become available balance. Payout requests reserve funds immediately (no double-spending);
  declined payouts release them. Minimum payout is $10.
- Jobs with logged time can be closed but not deleted.

## Tests

```bash
pytest -q
```
