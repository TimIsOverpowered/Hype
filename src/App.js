import React, { useEffect } from "react";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import client from "./feathers";
import Frontpage from "./frontpage";

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
      <BrowserRouter>
        <Switch>
          <Route exact path="/" render={(props) => <Frontpage {...props} user={user} />} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}
