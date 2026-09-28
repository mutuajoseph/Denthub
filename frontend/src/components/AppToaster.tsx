import { Toaster } from "react-hot-toast";

/** Global toast host, styled as a Graphite card (docs/design/DESIGN.md). */
export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 2500,
        className:
          "!rounded-button !bg-graphite !text-paper !text-sm !font-medium !shadow-card-graphite",
      }}
    />
  );
}
