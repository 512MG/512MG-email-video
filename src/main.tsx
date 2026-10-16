import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./index.css";
import { AuthProvider } from "./lib/auth";
import Layout from "./pages/Layout";
import Orgs from "./pages/Orgs";
import OrgPage from "./pages/OrgPage";
import VideoPage from "./pages/VideoPage";
import Watch from "./pages/Watch";
import Report from "./pages/Report";
import { Account, Setup, Verify } from "./pages/Auth";
import Landing from "./pages/Landing";
import Reset from "./pages/Reset";
import { Privacy, Terms } from "./pages/Legal";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/v/:org/:video" element={<Watch />} />
        <Route path="/r/:token" element={<Report />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Landing />} />
              <Route path="/signup" element={<Landing initial="signup" />} />
              <Route path="/reset" element={<Reset />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/verify" element={<Verify />} />
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
