import React, { useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import client, { getUser } from "./auth.js";
import NavBar from "./navbar.js";
import NotFound from "./utils/NotFound.js";
import Settings from "./settings.js";
import Whitelist from "./whitelist.js";
import Channel from "./channel.js";
import Vod from "./vods/Vod.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function useUser() {
  return useQuery({ queryKey: ["user"], queryFn: getUser });
}

function NavBarWithUser() {
  const { data: user } = useUser();
  return <NavBar user={user} />;
}

function SettingsWithUser() {
  const { data: user } = useUser();
  return <Settings user={user} />;
}

function ChannelWithUser() {
  const { data: user } = useUser();
  return <Channel user={user} />;
}

function VodWithUser() {
  const { data: user } = useUser();
  return <Vod user={user} />;
}

function AppRoutes() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (window.api) {
      window.api.receive("access_token", async (access_token) => {
        try {
          const result = await client.authenticate({
            strategy: "jwt",
            accessToken: access_token,
          });
          if (result?.user) {
            queryClient.setQueryData(["user"], result.user);
          }
          queryClient.invalidateQueries({ queryKey: ["user"] });
        } catch {
          queryClient.setQueryData(["user"], null);
        }
      });
    }
  }, [queryClient]);

  return (
    <HashRouter>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <NavBarWithUser />
              <NotFound />
            </>
          }
        />
        <Route
          exact
          path="/"
          element={
            <>
              <NavBarWithUser />
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
              <NavBarWithUser />
              <SettingsWithUser />
            </>
          }
        />
        <Route
          exact
          path="/:channel"
          element={
            <>
              <NavBarWithUser />
              <ChannelWithUser />
            </>
          }
        />
        <Route
          exact
          path="/vods/:vodId"
          element={
            <>
              <NavBarWithUser />
              <VodWithUser />
            </>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
