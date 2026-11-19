import { DatabaseSync } from "node:sqlite";
export function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}
export class Budget {
  constructor(path, limitPhp = 500) {
    if (!Number.isFinite(limitPhp) || limitPhp <= 0 || limitPhp > 500)
      throw Error("Monthly limit must be > 0 and <= PHP 500.");
    this.limit = Math.floor(limitPhp * 100);
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, month TEXT NOT NULL, cents INTEGER NOT NULL CHECK(cents>0))",
    );
  }
  status(month = monthKey()) {
    const used = this.db
      .prepare(
        "SELECT COALESCE(SUM(cents),0) AS used FROM reservations WHERE month=?",
      )
      .get(month).used;
    return {
      month,
      limitPhp: this.limit / 100,
      usedPhp: used / 100,
      remainingPhp: Math.max(0, this.limit - used) / 100,
    };
  }
  reserve(id, php, month = monthKey()) {
    const cents = Math.ceil(php * 100);
    if (!Number.isFinite(cents) || cents <= 0 || cents > this.limit)
      throw Error("Invalid maximum request cost.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.db.prepare("SELECT id FROM reservations WHERE id=?").get(id))
        throw Error(
          "Duplicate request; never automatically retry a paid request.",
        );
      const s = this.status(month);
      if (Math.round(s.usedPhp * 100) + cents > this.limit)
        throw Error("Monthly budget exhausted.");
      this.db
        .prepare("INSERT INTO reservations VALUES (?,?,?)")
        .run(id, month, cents);
      this.db.exec("COMMIT");
      return this.status(month);
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
