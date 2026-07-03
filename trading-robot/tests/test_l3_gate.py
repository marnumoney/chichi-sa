import json, os, sys, threading, time
from unittest.mock import MagicMock

# Mock MetaTrader5 and other heavy dependencies before importing bot
sys.modules['MetaTrader5'] = MagicMock()
sys.modules['anthropic'] = MagicMock()
sys.modules['dotenv'] = MagicMock()
# Mock dotenv.load_dotenv
import dotenv
dotenv.load_dotenv = MagicMock()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Mock all bot-level module imports
sys.modules['config'] = MagicMock()
sys.modules['broker'] = MagicMock()
sys.modules['db'] = MagicMock()
sys.modules['session'] = MagicMock()
sys.modules['strategy'] = MagicMock()
sys.modules['risk'] = MagicMock()
sys.modules['news'] = MagicMock()
sys.modules['cot'] = MagicMock()

import bot


def test_l3_gate_approved(tmp_path):
    pending_dir = tmp_path / "pending"
    approved_dir = tmp_path / "approved"
    rejected_dir = tmp_path / "rejected"
    for d in [pending_dir, approved_dir, rejected_dir]:
        d.mkdir()

    def approve_later():
        time.sleep(0.3)
        trade_id = list(pending_dir.iterdir())[0].stem
        (approved_dir / f"{trade_id}.json").write_text(
            json.dumps({"id": trade_id, "approved": True})
        )

    th = threading.Thread(target=approve_later)
    th.start()
    result = bot.l3_gate("EURUSD", "long", 0.1, 1.085, pending_dir, approved_dir, rejected_dir, timeout=5)
    th.join()
    assert result is True


def test_l3_gate_below_threshold(tmp_path):
    pending_dir = tmp_path / "pending"
    approved_dir = tmp_path / "approved"
    rejected_dir = tmp_path / "rejected"
    for d in [pending_dir, approved_dir, rejected_dir]:
        d.mkdir()
    # 0.0001 * 100000 * 1.085 = $10.85 — below $50 threshold
    result = bot.l3_gate("EURUSD", "long", 0.0001, 1.085, pending_dir, approved_dir, rejected_dir, timeout=5)
    assert result is True
    assert list(pending_dir.iterdir()) == []


def test_l3_gate_short_skipped(tmp_path):
    pending_dir = tmp_path / "pending"
    approved_dir = tmp_path / "approved"
    rejected_dir = tmp_path / "rejected"
    for d in [pending_dir, approved_dir, rejected_dir]:
        d.mkdir()
    result = bot.l3_gate("EURUSD", "short", 1.0, 1.085, pending_dir, approved_dir, rejected_dir, timeout=5)
    assert result is True
    assert list(pending_dir.iterdir()) == []
