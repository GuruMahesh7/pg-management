import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Initialize API client with production URL if available
const API_URL = import.meta.env.NEXT_PUBLIC_API_URL || "";
setBaseUrl(API_URL);

createRoot(document.getElementById("root")!).render(<App />);
