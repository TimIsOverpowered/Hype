import React, { useEffect, useRef, useState } from "react";
import { Box, Typography, Grid } from "@mui/material";
import SimpleBar from "simplebar-react";
import { LogoLoading } from "./utils/Loading.js";
import Twitch from "./twitch/gql.js";
import CustomLink from "./utils/CustomLink.js";

const PAGE_LIMIT = 100;

export default function Whitelist() {
  const [channels, setChannels] = useState([]);
  const [twitchUsers, setTwitchUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const resolvedRef = useRef(new Set());

  const fetchPage = async (pageNum) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.hype.lol/v1/whitelist?page=${pageNum}&limit=${PAGE_LIMIT}&sort=channel`,
      );
      const data = await res.json();
      const newChannels = data.data || [];

      if (newChannels.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      setChannels((prev) => {
        const merged = [...prev, ...newChannels];
        merged.sort((a, b) => a.channel.toLowerCase().localeCompare(b.channel.toLowerCase()));
        return merged;
      });

      setHasMore(pageNum * PAGE_LIMIT < data.total);
      setPage(pageNum + 1);

      const newLogins = newChannels
        .filter((c) => !resolvedRef.current.has(c.channel))
        .map((c) => c.channel);

      if (newLogins.length > 0) {
        resolvedRef.current.add(...newLogins);
        const newUsers = await Twitch.getUsers(JSON.stringify(newLogins));
        setTwitchUsers((prev) => [...prev, ...newUsers]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (channels.length > 0) setHasInitialized(true);
  }, [channels]);

  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasInitialized || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchPage(page);
        }
      },
      { rootMargin: "200px" },
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasInitialized, hasMore, loading, page]);

  if (!hasInitialized) return <LogoLoading />;

  return (
    <SimpleBar style={{ minHeight: 0, height: "100%" }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <Typography variant="h4">There are currently {twitchUsers.length} whitelisted channels!</Typography>
          <Grid container spacing={3} sx={{ mt: 5, justifyContent: "center" }}>
            {twitchUsers.filter(Boolean).map((user, i) => (
              <StyledProfile key={user.id || i} user={user} />
            ))}
            {loading && (
              <Grid item xs={2} sx={{ maxWidth: "18rem", flexBasis: "18rem", display: "flex", justifyContent: "center" }}>
                <Box sx={{ width: "100%", aspectRatio: "1", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.1)", animation: "pulse 1.5s ease-in-out infinite" }} />
              </Grid>
            )}
          </Grid>
        </Box>
        <div ref={sentinelRef} />
      </Box>
    </SimpleBar>
  );
}

const StyledProfile = (props) => {
  const { user } = props;
  if (!user) return null;

  return (
    <Grid item xs={2} sx={{ maxWidth: "18rem", flexBasis: "18rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Box sx={{ maxWidth: "12rem", textAlign: "center" }}>
        <CustomLink href={`/${user.login}`}>
          <img alt="" src={user.profileImageURL} />
          <Typography mt={1} variant="h6">
            {user.displayName}
          </Typography>
        </CustomLink>
      </Box>
    </Grid>
  );
};
