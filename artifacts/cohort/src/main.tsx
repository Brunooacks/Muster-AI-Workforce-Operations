import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { inicializarPerfil } from "@/components/profile-switcher";

inicializarPerfil();

createRoot(document.getElementById("root")!).render(<App />);
