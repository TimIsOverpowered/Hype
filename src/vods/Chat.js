import { useEffect, useState, useRef, createRef, useCallback } from "react";
import { Box, Typography, Tooltip, Divider, Button } from "@mui/material";
import SimpleBar from "simplebar-react";
import { BasicLoading } from "../utils/Loading";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Twemoji from "react-twemoji";
import Twitch from "../twitch/gql";
import CustomCollapse from "./chat/CustomCollapse";
import ExpandMore from "./chat/CustomExpandMore";

const BASE_TWITCH_CDN = "https://static-cdn.jtvnw.net";
const BASE_FFZ_EMOTE_CDN = "https://cdn.frankerfacez.com/emote";
const BASE_BTTV_EMOTE_CDN = "https://cdn.betterttv.net/emote";
const BASE_7TV_EMOTE_CDN = "https://cdn.7tv.app/emote";
const BASE_FFZ_EMOTE_API = "https://api.frankerfacez.com/v1";
const BASE_BTTV_EMOTE_API = "https://api.betterttv.net/3";
const BASE_7TV_EMOTE_API = "https://api.7tv.app/v3";

let messageCount = 0;
let badgesCount = 0;

export default function Chat(props) {
  const { vodId, player, playing, userChatDelay, twitchId } = props;
  const [showChat, setShowChat] = useState(true);
  const [shownMessages, setShownMessages] = useState([]);
  const comments = useRef([]);
  const badges = useRef();
  const emotes = useRef({
    BTTV: [],
    FFZ: [],
    "7TV": [],
  });
  const cursor = useRef();
  const loopRef = useRef();
  const playRef = useRef();
  const chatRef = useRef();
  const stoppedAtIndex = useRef(0);
  const newMessages = useRef();
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    if (chatRef && chatRef.current) {
      const ref = chatRef.current;
      const handleScroll = (e) => {
        e.stopPropagation();
        const atBottom = ref.scrollHeight - ref.clientHeight - ref.scrollTop < 64;
        setScrolling(!atBottom);
      };

      ref.addEventListener("scroll", handleScroll);

      return () => ref.removeEventListener("scroll", handleScroll);
    }
  });

  useEffect(() => {
    if (!vodId || !twitchId) return;

    const loadBadges = async () => {
      badges.current = await Twitch.getBadges(vodId);
    };

    const loadBTTVGlobalEmotes = () => {
      fetch(`${BASE_BTTV_EMOTE_API}/cached/emotes/global`, {
        method: "GET",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status >= 400) return;
          emotes.current["BTTV"] = data;
          loadBTTVChannelEmotes();
        })
        .catch((e) => {
          console.error(e);
        });
    };

    const loadBTTVChannelEmotes = () => {
      fetch(`${BASE_BTTV_EMOTE_API}/cached/users/twitch/${twitchId}`, {
        method: "GET",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status >= 400) return;
          emotes.current["BTTV"] = emotes.current["BTTV"].concat(data.sharedEmotes.concat(data.channelEmotes));
        })
        .catch((e) => {
          console.error(e);
        });
    };

    const loadFFZEmotes = () => {
      fetch(`${BASE_FFZ_EMOTE_API}/room/id/${twitchId}`, {
        method: "GET",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status >= 400) return;
          emotes.current["FFZ"] = data.sets[data.room.set].emoticons;
        })
        .catch((e) => {
          console.error(e);
        });
    };

    const load7TVEmotes = () => {
      fetch(`${BASE_7TV_EMOTE_API}/users/twitch/${twitchId}`, {
        method: "GET",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status_code >= 400) return;
          emotes.current["7TV"] = data.emote_set.emotes;
        })
        .catch((e) => {
          console.error(e);
        });
    };

    const loadEmotes = () => {
      loadBTTVGlobalEmotes();
      load7TVEmotes();
      loadFFZEmotes();
    };

    loadEmotes();
    loadBadges();
  }, [vodId, twitchId]);

  const getCurrentTime = useCallback(() => {
    if (!player) return 0;
    let time = 0;
    time += player.currentTime();
    time += userChatDelay;
    return time;
  }, [player, userChatDelay]);

  const buildComments = useCallback(async () => {
    if (!player || !comments.current || comments.current.length === 0 || !cursor.current || stoppedAtIndex.current === null) return;
    if (player.paused()) return;

    const time = getCurrentTime();
    let lastIndex = comments.current.length - 1;
    for (let i = stoppedAtIndex.current.valueOf(); i < comments.current.length; i++) {
      if (comments.current[i].node.contentOffsetSeconds > time) {
        lastIndex = i;
        break;
      }
    }

    if (stoppedAtIndex.current === lastIndex && stoppedAtIndex.current !== 0) return;

    const transformBadges = (textBadges) => {
      const badgeWrapper = [];
      if (!badges.current) return;
      const channelBadges = badges.current.channelBadges;
      const globalBadges = badges.current.globalBadges;

      for (const textBadge of textBadges) {
        const badgeId = textBadge.setID;
        const version = textBadge.version;

        if (channelBadges) {
          const badge = channelBadges.find((channelBadge) => channelBadge.setID === badgeId && channelBadge.version === version);

          if (badge) {
            badgeWrapper.push(
              <img
                key={badgesCount++}
                crossOrigin="anonymous"
                style={{ display: "inline-block", minWidth: "1rem", height: "1rem", margin: "0 .2rem .1rem 0", backgroundPosition: "50%", verticalAlign: "middle" }}
                srcSet={`${badge.image1x} 1x, ${badge.image2x} 2x, ${badge.image3x} 3x`}
                src={badge.image1x}
                alt=""
              />
            );
            continue;
          }
        }

        if (globalBadges) {
          const badge = globalBadges.find((globalBadge) => globalBadge.setID === badgeId && globalBadge.version === version);
          if (badge) {
            badgeWrapper.push(
              <img
                key={badgesCount++}
                crossOrigin="anonymous"
                style={{ display: "inline-block", minWidth: "1rem", height: "1rem", margin: "0 .2rem .1rem 0", backgroundPosition: "50%", verticalAlign: "middle" }}
                srcSet={`${badge.image1x} 1x, ${badge.image2x} 2x, ${badge.image3x} 3x`}
                src={badge.image1x}
                alt=""
              />
            );
            continue;
          }
        }
      }

      return <Box sx={{ display: "inline" }}>{badgeWrapper}</Box>;
    };

    const transformMessage = (fragments) => {
      if (!fragments) return;

      const textFragments = [];
      for (let i = 0; i < fragments.length; i++) {
        const fragment = fragments[i];
        if (fragment.emote) {
          textFragments.push(
            <Box key={i + fragment.emote.emoteID} sx={{ display: "inline" }}>
              <img
                crossOrigin="anonymous"
                style={{ verticalAlign: "middle", border: "none", maxWidth: "100%" }}
                src={`${BASE_TWITCH_CDN}/emoticons/v2/${fragment.emote.emoteID}/default/dark/1.0`}
                alt=""
              />{" "}
            </Box>
          );
          continue;
        }

        let textArray = fragment.text.split(" ");

        for (let text of textArray) {
          if (emotes.current) {
            const SEVENTV_EMOTES = emotes.current["7TV"];
            const BTTV_EMOTES = emotes.current["BTTV"];
            const FFZ_EMOTES = emotes.current["FFZ"];

            if (SEVENTV_EMOTES) {
              const emote = SEVENTV_EMOTES.find((SEVENTV_EMOTE) => SEVENTV_EMOTE.name === text);
              if (emote) {
                textFragments.push(
                  <Box key={messageCount++} style={{ display: "inline" }}>
                    <img
                      crossOrigin="anonymous"
                      style={{ verticalAlign: "middle", border: "none", maxWidth: "100%" }}
                      src={`${BASE_7TV_EMOTE_CDN}/${emote.id}/1x`}
                      srcSet={`${BASE_7TV_EMOTE_CDN}/${emote.id}/1x 1x, ${BASE_7TV_EMOTE_CDN}/${emote.id}/2x 2x, ${BASE_7TV_EMOTE_CDN}/${emote.id}/4x 4x`}
                      alt=""
                    />{" "}
                  </Box>
                );
                continue;
              }
            }

            if (FFZ_EMOTES) {
              const emote = FFZ_EMOTES.find((FFZ_EMOTE) => FFZ_EMOTE.name === text);
              if (emote) {
                textFragments.push(
                  <Box key={messageCount++} style={{ display: "inline" }}>
                    <img
                      crossOrigin="anonymous"
                      style={{ verticalAlign: "middle", border: "none", maxWidth: "100%" }}
                      src={`${BASE_FFZ_EMOTE_CDN}/${emote.id}/1`}
                      srcSet={`${BASE_FFZ_EMOTE_CDN}/${emote.id}/1 1x, ${BASE_FFZ_EMOTE_CDN}/${emote.id}/2 2x, ${BASE_FFZ_EMOTE_CDN}/${emote.id}/4 4x`}
                      alt=""
                    />{" "}
                  </Box>
                );
                continue;
              }
            }

            if (BTTV_EMOTES) {
              const emote = BTTV_EMOTES.find((BTTV_EMOTE) => BTTV_EMOTE.code === text);
              if (emote) {
                textFragments.push(
                  <Box key={messageCount++} style={{ display: "inline" }}>
                    <img
                      crossOrigin="anonymous"
                      style={{ verticalAlign: "middle", border: "none", maxWidth: "100%" }}
                      src={`${BASE_BTTV_EMOTE_CDN}/${emote.id}/1x`}
                      srcSet={`${BASE_BTTV_EMOTE_CDN}/${emote.id}/1x 1x, ${BASE_BTTV_EMOTE_CDN}/${emote.id}/2x 2x, ${BASE_BTTV_EMOTE_CDN}/${emote.id}/4x 4x`}
                      alt=""
                    />{" "}
                  </Box>
                );
                continue;
              }
            }
          }

          textFragments.push(
            <Twemoji key={messageCount++} noWrapper options={{ className: "twemoji" }}>
              <Typography variant="body1" display="inline">{`${text} `}</Typography>
            </Twemoji>
          );
        }
      }
      return <Box sx={{ display: "inline" }}>{textFragments}</Box>;
    };

    const messages = [];
    for (let i = stoppedAtIndex.current.valueOf(); i < lastIndex; i++) {
      const comment = comments.current[i].node;
      if (!comment.message) continue;
      messages.push(
        <Box key={comment.id} ref={createRef()} sx={{ width: "100%" }}>
          <Box sx={{ alignItems: "flex-start", display: "flex", flexWrap: "nowrap", width: "100%", pl: 0.5, pt: 0.5, pr: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
              <Box sx={{ flexGrow: 1, pl: 1 }}>
                {comment.message.userBadges && transformBadges(comment.message.userBadges)}
                <Box sx={{ textDecoration: "none", display: "inline" }}>
                  <span style={{ color: comment.message.userColor, fontWeight: 600 }}>{comment.commenter.displayName}</span>
                </Box>
                <Box sx={{ display: "inline" }}>
                  <span>: </span>
                  {transformMessage(comment.message.fragments)}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      );
    }

    newMessages.current = messages;

    setShownMessages((shownMessages) => {
      const concatMessages = shownMessages.concat(messages);
      if (concatMessages.length > 200) concatMessages.splice(0, messages.length);

      return concatMessages;
    });

    stoppedAtIndex.current = lastIndex;
    if (comments.current.length - 1 === lastIndex) {
      const nextRes = await Twitch.getNextComments(vodId, cursor.current);
      stoppedAtIndex.current = 0;
      comments.current = nextRes;
      cursor.current = nextRes[nextRes.length - 1].cursor;
    }
  }, [getCurrentTime, player, vodId]);

  const loop = useCallback(() => {
    if (loopRef.current !== null) clearInterval(loopRef.current);
    buildComments();
    loopRef.current = setInterval(buildComments, 1000);
  }, [buildComments]);

  useEffect(() => {
    if (!playing || stoppedAtIndex.current === undefined) return;
    const time = Math.floor(getCurrentTime());

    if (comments.current && comments.current.length > 0) {
      const lastComment = comments.current[comments.current.length - 1].node;
      const firstComment = comments.current[0].node;

      if (time - lastComment.contentOffsetSeconds <= 30 && time > firstComment.contentOffsetSeconds) {
        if (comments.current[stoppedAtIndex.current].contentOffsetSeconds - time >= 4) {
          stoppedAtIndex.current = 0;
          setShownMessages([]);
        }
        loop();
        return;
      }
    }
    if (playRef.current) clearTimeout(playRef.current);

    playRef.current = setTimeout(async () => {
      stopLoop();
      stoppedAtIndex.current = 0;
      comments.current = [];
      cursor.current = null;
      setShownMessages([]);
      const commentsRes = await Twitch.getComments(vodId, time);
      comments.current = commentsRes;
      cursor.current = commentsRes[commentsRes.length - 1].cursor;
      loop();
    }, 300);

    return () => stopLoop();
  }, [playing, vodId, getCurrentTime, loop]);

  const stopLoop = () => {
    if (loopRef.current !== null) clearInterval(loopRef.current);
  };

  useEffect(() => {
    if (!chatRef.current || shownMessages.length === 0) return;

    let messageHeight = 0;
    for (let message of newMessages.current) {
      if (!message.ref.current) continue;
      messageHeight += message.ref.current.scrollHeight;
    }
    const atBottom = chatRef.current.scrollHeight - chatRef.current.clientHeight - chatRef.current.scrollTop - messageHeight < 64;
    if (atBottom) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [shownMessages]);

  const scrollToBottom = () => {
    setScrolling(false);
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  };

  return (
    <Box sx={{ height: "100%", background: "#131314", display: "flex", flexDirection: "column" }}>
      {showChat ? (
        <>
          <Box sx={{ display: "grid", alignItems: "center", p: 1 }}>
            <Box sx={{ justifySelf: "left", gridColumnStart: 1, gridRowStart: 1 }}>
              <Tooltip title="Collapse">
                <ExpandMore expand={showChat} onClick={() => setShowChat(false)} aria-expanded={showChat}>
                  <ExpandMoreIcon />
                </ExpandMore>
              </Tooltip>
            </Box>
            <Box sx={{ justifySelf: "center", gridColumnStart: 1, gridRowStart: 1 }}>
              <Typography variant="body1">Chat Replay</Typography>
            </Box>
          </Box>
          <Divider />
          <CustomCollapse in={showChat} timeout="auto" unmountOnExit sx={{ minWidth: "340px" }}>
            {shownMessages.length === 0 ? (
              <BasicLoading />
            ) : (
              <>
                <SimpleBar scrollableNodeProps={{ ref: chatRef }} style={{ height: "100%", overflowX: "hidden" }}>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", flexDirection: "column" }}>
                    <Box sx={{ display: "flex", flexWrap: "wrap", minHeight: 0, alignItems: "flex-end" }}>{shownMessages}</Box>
                  </Box>
                </SimpleBar>
                {scrolling && (
                  <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
                    <Box sx={{ background: "rgba(0,0,0,.6)", minHeight: 0, borderRadius: 1, mb: 1, bottom: 0, position: "absolute" }}>
                      <Button size="small" onClick={scrollToBottom}>
                        Chat Paused
                      </Button>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </CustomCollapse>
        </>
      ) : (
        <Box sx={{ position: "absolute", right: 0 }}>
          <Tooltip title="Expand">
            <ExpandMore expand={showChat} onClick={() => setShowChat(true)} aria-expanded={showChat}>
              <ExpandMoreIcon />
            </ExpandMore>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
