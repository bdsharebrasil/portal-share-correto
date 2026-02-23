import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppProviders from "@/app/providers";
import AppRouter from "@/app/router";

const App = () => (
  <ErrorBoundary>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </ErrorBoundary>
);

export default App;
