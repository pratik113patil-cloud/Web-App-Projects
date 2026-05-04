/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Group 7 - Database Controller (Persistence Layer)
 * Implementation: SQLite3 for local-first engineering reliability.
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'study_planner.db');
const db = new Database(dbPath);

// -- Schema Initialization --
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT,
      weightage INTEGER,
      deadline TEXT,
      confidence INTEGER,
      estimatedMinutes INTEGER,
      status TEXT DEFAULT 'pending',
      completedAt TEXT,
      category TEXT DEFAULT 'Theory'
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      deck_name TEXT,
      question TEXT NOT NULL,
      answer_markdown TEXT NOT NULL,
      deck_status TEXT DEFAULT 'New'
    );

    CREATE TABLE IF NOT EXISTS protected_blocks (
      id TEXT PRIMARY KEY,
      label TEXT,
      startHour INTEGER,
      startMinute INTEGER,
      endHour INTEGER,
      endMinute INTEGER
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      taskId TEXT,
      startTime TEXT,
      endTime TEXT,
      taskTitle TEXT,
      scheduled_date TEXT
    );
  `);

  // -- Migrations (Handle evolving schema) --
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'Theory'`);
  } catch (e) {
    // Already exists or table missing
  }

  // REWRITE FROM SCRATCH: Force clean state for flashcards
  db.exec("DROP TABLE IF EXISTS flashcards;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY,
      deck_name TEXT,
      question TEXT NOT NULL,
      answer_markdown TEXT NOT NULL,
      deck_status TEXT DEFAULT 'New'
    );
  `);

  console.log('--- DB [SQLite3] Initialized Successfully ---');
}

// -- Task Operations --
export const taskOps = {
  getAll: () => db.prepare('SELECT * FROM tasks').all(),
  add: (task: any) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, subject, weightage, deadline, confidence, estimatedMinutes, status, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(task.id, task.title, task.subject, task.weightage, task.deadline, task.confidence, task.estimatedMinutes, task.status, task.category || 'Theory');
  },
  updateStatus: (id: string, status: string, completedAt?: string) => {
    return db.prepare('UPDATE tasks SET status = ?, completedAt = ? WHERE id = ?').run(status, completedAt || null, id);
  },
  delete: (id: string) => db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
};

// -- Flashcard Operations --
export const cardOps = {
  getAll: () => db.prepare('SELECT * FROM flashcards').all(),
  add: (card: any) => {
    const stmt = db.prepare(`
      INSERT INTO flashcards (id, deck_name, question, answer_markdown, deck_status)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(card.id, card.deck_name, card.question, card.answer_markdown, card.deck_status || 'New');
  },
  updateDeckStatus: (id: string, deck_status: string) => {
    return db.prepare('UPDATE flashcards SET deck_status = ? WHERE id = ?').run(deck_status, id);
  },
  update: (id: string, card: any) => {
    const stmt = db.prepare(`
      UPDATE flashcards 
      SET deck_name = ?, question = ?, answer_markdown = ?
      WHERE id = ?
    `);
    return stmt.run(card.deck_name, card.question, card.answer_markdown, id);
  },
  delete: (id: string) => db.prepare('DELETE FROM flashcards WHERE id = ?').run(id)
};

// -- Schedule Operations --
export const scheduleOps = {
  getAll: () => db.prepare('SELECT * FROM schedule').all(),
  getToday: (todayStr: string) => db.prepare('SELECT * FROM schedule WHERE scheduled_date = ?').all(todayStr),
  replace: (chunks: any[]) => {
    // Transactional replace
    const deleteStmt = db.prepare('DELETE FROM schedule');
    const insertStmt = db.prepare(`
      INSERT INTO schedule (id, taskId, startTime, endTime, taskTitle, scheduled_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = db.transaction((data: any[]) => {
      deleteStmt.run();
      for (const item of data) {
        insertStmt.run(item.id, item.taskId, item.startTime, item.endTime, item.taskTitle, item.scheduled_date || item.startTime.split('T')[0]);
      }
    });
    
    return transaction(chunks);
  }
};

// -- Block Operations --
export const blockOps = {
  getAll: () => db.prepare('SELECT * FROM protected_blocks').all(),
  add: (block: any) => {
    const stmt = db.prepare(`
      INSERT INTO protected_blocks (id, label, startHour, startMinute, endHour, endMinute)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(block.id, block.label, block.startHour, block.startMinute, block.endHour, block.endMinute);
  },
  delete: (id: string) => db.prepare('DELETE FROM protected_blocks WHERE id = ?').run(id)
};

export default db;
