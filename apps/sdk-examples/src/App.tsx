import { SanityApp } from "@sanity/sdk-react";
import { RouterProvider } from "react-router";
import { router } from "./router";

export default function App() {
  return (
    <SanityApp
      resources={{
        default: {
          projectId: "ppsg7ml5",
          dataset: "production",
        },
      }}
      fallback={<div>Loading…</div>}
    >
      <RouterProvider router={router} />
    </SanityApp>
  );
}
