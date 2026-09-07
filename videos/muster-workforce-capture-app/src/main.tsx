import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WorkforceOsLabPage from "@/pages/workforce-os-lab";
import "./capture.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WorkforceOsLabPage labMode={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);
