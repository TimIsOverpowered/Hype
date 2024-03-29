import React, { useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import client from "./client";
import NavBar from "./navbar";
import NotFound from "./utils/NotFound";
import Settings from "./settings";
import { LogoLoading } from "./utils/Loading";
import Whitelist from "./whitelist";
import Channel from "./channel";
import Vod from "./vods/Vod";

export default function App() {
  const [user, setUser] = React.useState(undefined);
  useEffect(() => {
    if (window.api)
      window.api.receive("access_token", (access_token) => {
        client
          .authenticate({
            strategy: "jwt",
            accessToken: access_token,
          })
          .catch(() => setUser(null));
      });

    client.authenticate().catch(() => setUser(null));

    client.on("authenticated", (paramUser) => {
      setUser(paramUser.user);
    });

    client.service("users").on("patched", (paramUser) => {
      if (!user || !paramUser) return;
      if (paramUser.id === user.id) {
        client
          .service("users")
          .get(user.id)
          .then((user) => {
            setUser(user);
          })
          .catch((e) => {
            console.error(e);
          });
      }
    });

    client.on("logout", () => {
      setUser(null);
    });

    return;
  }, [user]);

  if (user === undefined) return <LogoLoading />;

  return (
    <HashRouter>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NavBar user={user} />
              <NotFound />
            </>
          }
        />
        <Route
          exact
          path="/"
          element={
            <>
              <NavBar user={user} />
              <Whitelist />
            </>
          }
        />
        <Route exact path="/settings" element={<Navigate to="/settings/profile" replace />} />
        <Route
          exact
          path="/settings/:subPath"
          element={
            <>
              <NavBar user={user} />
              <Settings user={user} />
            </>
          }
        />
        <Route
          exact
          path="/:channel"
          element={
            <>
              <NavBar user={user} />
              <Channel user={user} />
            </>
          }
        />
        <Route
          exact
          path="/vods/:vodId"
          element={
            <>
              <NavBar user={user} />
              <Vod user={user} />
            </>
          }
        />
      </Routes>
    </HashRouter>
  );
}
