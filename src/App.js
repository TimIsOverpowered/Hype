import React, { useEffect } from "react";
import { HashRouter, Route, Switch } from "react-router-dom";
import client from "./client";
import Frontpage from "./frontpage";
import Channel from "./channel";
import NavBar from "./navbar";
import Vod from "./vod";

export default function App() {
  const [user, setUser] = React.useState(undefined);
  useEffect(() => {
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
      window.location.href = "/";
    });

    return;
  }, [user]);

  return (
    <div className="hype-root">
      <HashRouter>
        <Switch>
          <Route
            exact
            path="/"
            render={(props) => <Frontpage {...props} user={user} />}
          />
          <Route
            exact
            path="/:channel"
            render={(props) => (
              <>
                <NavBar {...props} />
                <Channel {...props} user={user} />
              </>
            )}
          />
          <Route
            exact
            path="/:channel/:vodId"
            render={(props) => (
              <>
                <NavBar {...props} />
                <Vod {...props} user={user} />
              </>
            )}
          />
        </Switch>
      </HashRouter>
    </div>
  );
}
