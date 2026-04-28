/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SMART STUDY PLANNER - ENTERPRISE EDITION
 * Initialized by: Group 7 (First Year Engineering)
 * Authors: Lead Dev (Eng Opt), UI Architect (Swiss Style)
 * 
 * "Optimizing engineering workflows since Freshman year."
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
