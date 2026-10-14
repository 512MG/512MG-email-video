import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import Layout from "./pages/Layout";
import Orgs from "./pages/Orgs";
import OrgPage from "./pages/OrgPage";
import VideoPage from "./pages/VideoPage";
import Watch from "./pages/Watch";
import { Account, Login, Setup } from "./pages/Auth";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/v/:org/:video" element={<Watch />} />
        <Route path="*" element={
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/setup" element={<Setup />} />
              <Route element={<Layout />}>
                <Route index element={<Orgs />} />
                <Route path="/o/:orgId" element={<OrgPage />} />
                <Route path="/o/:orgId/v/:videoId" element={<VideoPage />} />
                <Route path="/account" element={<Account />} />
              </Route>
            </Routes>
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
