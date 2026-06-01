import { createRoot } from "react-dom/client";
import { supabase } from "@/lib/supabase";
import App from "./App.tsx";
import "./index.css";

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    localStorage.removeItem("rez1_location");
    window.location.href = "/";
  }
});

createRoot(document.getElementById("root")!).render(<App />);
