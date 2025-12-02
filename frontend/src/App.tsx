import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { ValidationPage } from './pages/ValidationPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResultsPage } from './pages/ResultsPage';
import { CodeSkeletonPage } from './pages/CodeSkeletonPage';
import { ToastProvider } from './components/ui/ToastContainer';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ConfigurationPage />} />
          <Route path="/validation/:jobId" element={<ValidationPage />} />
          <Route path="/progress/:jobId" element={<ProgressPage />} />
          <Route path="/results/:jobId" element={<ResultsPage />} />
          <Route path="/code/:jobId" element={<CodeSkeletonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
