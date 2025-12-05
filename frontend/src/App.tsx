import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigurationPage } from './pages/ConfigurationPage';
import { ValidationPage } from './pages/ValidationPage';
import { CodeSkeletonPage } from './pages/CodeSkeletonPage';
import { EpicsRefinementPage } from './pages/EpicsRefinementPage';
import { FunctionalTestsRefinementPage } from './pages/FunctionalTestsRefinementPage';
import { GherkinTestsRefinementPage } from './pages/GherkinTestsRefinementPage';
import { DataModelPage } from './pages/DataModelPage';
import { SummaryPage } from './pages/SummaryPage';
import { ToastProvider } from './components/ui/ToastContainer';

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ConfigurationPage />} />
          <Route path="/validation/:jobId" element={<ValidationPage />} />
          <Route path="/epics/:jobId" element={<EpicsRefinementPage />} />
          <Route path="/functional-tests/:jobId" element={<FunctionalTestsRefinementPage />} />
          <Route path="/gherkin-tests/:jobId" element={<GherkinTestsRefinementPage />} />
          <Route path="/data-model/:jobId" element={<DataModelPage />} />
          <Route path="/code/:jobId" element={<CodeSkeletonPage />} />
          <Route path="/summary/:jobId" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
