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
    client.authenticate().catch(() => setUser(null));

    client.on("authenticated", (user) => {
      setUser(user.user);
    });

    client.service("users").on("patched", (paramUser) => {
      if (paramUser.id === user.id) {
        setUser(paramUser);
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
          <Route exact path="/" render={(props) => <Frontpage {...props} user={user} />} />
          <Route exact path="/:channel" render={(props) => <> <NavBar {...props} /> <Channel {...props} user={user} /> </>} />
          <Route exact path="/:channel/:vodId" render={(props) => <> <NavBar {...props} /> <Vod {...props} user={user} /> </>} />
        </Switch>
      </HashRouter>
    </div>
  );
}
