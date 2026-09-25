import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import { initPwa } from "./services/pwa";

initPwa();
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
