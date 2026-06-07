import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initLanguagePersistence } from './i18n';
import { initCrashReporter } from './services/utils/crashReporter';
import { SiteRouter } from './site/SiteRouter';

initCrashReporter();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <SiteRouter />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

void initLanguagePersistence().finally(renderApp);
