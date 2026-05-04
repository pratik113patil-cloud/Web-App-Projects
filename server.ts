/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initDb, taskOps, cardOps, blockOps, scheduleOps } from './src/lib/db.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite
  initDb();

  app.use(express.json());

  // --- API Routes ---
  
  // Schedule
  app.get('/api/schedule', (req, res) => res.json(scheduleOps.getAll()));
  app.get('/api/schedule/today', (req, res) => {
    const todayStr = req.query.date as string;
    res.json(scheduleOps.getToday(todayStr));
  });
  app.post('/api/schedule/sync', (req, res) => {
    scheduleOps.replace(req.body);
    res.json({ success: true });
  });

  // Tasks
  app.get('/api/tasks', (req, res) => res.json(taskOps.getAll()));
  app.post('/api/tasks', (req, res) => {
    taskOps.add(req.body);
    res.status(201).json({ success: true });
  });
  app.patch('/api/tasks/:id', (req, res) => {
    taskOps.updateStatus(req.params.id, req.body.status, req.body.completedAt);
    res.json({ success: true });
  });
  app.delete('/api/tasks/:id', (req, res) => {
    taskOps.delete(req.params.id);
    res.json({ success: true });
  });

  // Flashcards
  app.get('/api/flashcards', (req, res) => res.json(cardOps.getAll()));
  app.post('/api/flashcards', (req, res) => {
    cardOps.add(req.body);
    res.status(201).json({ success: true });
  });
  app.patch('/api/flashcards/:id/deck-status', (req, res) => {
    const { deck_status } = req.body;
    cardOps.updateDeckStatus(req.params.id, deck_status);
    res.json({ success: true });
  });
  app.patch('/api/flashcards/:id', (req, res) => {
    cardOps.update(req.params.id, req.body);
    res.json({ success: true });
  });
  app.delete('/api/flashcards/:id', (req, res) => {
    cardOps.delete(req.params.id);
    res.json({ success: true });
  });

  // Blocks
  app.get('/api/blocks', (req, res) => res.json(blockOps.getAll()));
  app.post('/api/blocks', (req, res) => {
    blockOps.add(req.body);
    res.status(201).json({ success: true });
  });
  app.delete('/api/blocks/:id', (req, res) => {
    blockOps.delete(req.params.id);
    res.json({ success: true });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Study Planner running on http://localhost:${PORT}`);
  });
}

startServer();
