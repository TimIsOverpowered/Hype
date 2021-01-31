import React, { Component } from "react";
import { TwitchPlayer } from "react-twitch-embed";
import client from "./client";
import {
  CircularProgress,
  Typography,
  Box,
  withStyles,
  Container,
} from "@material-ui/core";
import Logo from "./assets/logo.svg";
import { ZSTDDecoder } from "zstddec";
import SimpleBar from "simplebar-react";

class Vod extends Component {
  constructor(props) {
    super(props);

    this.BADGES_TWITCH_URL =
      "https://badges.twitch.tv/v1/badges/global/display?language=en";
    this.BASE_TWITCH_CDN = "https://static-cdn.jtvnw.net/";
    this.BASE_TWITCH_EMOTES_API = "https://api.twitchemotes.com/api/v4/";
    this.BASE_FFZ_EMOTE_API = "https://api.frankerfacez.com/v1/";
    this.BASE_BTTV_EMOTE_API = "https://api.betterttv.net/3/";
    this.BASE_BTTV_CDN = "https://cdn.betterttv.net/";
    this.channel = this.props.match.params.channel;
    this.vodId = this.props.match.params.vodId;
    this.player = null;
    this.chatRef = React.createRef();
    this.classes = props.classes;
    this.messageCount = 0;
    this.badgesCount = 0;
    this.state = {
      chatInterval: null,
      chatLoading: true,
      replayMessages: null,
      comments: [],
      stoppedAtIndex: 0,
    };
  }

  componentDidMount() {
    document.title = `${this.channel} - ${this.vodId}`;
    if (!this.props.user) return;
    this.fetchLogs();
    this.getTwitchId();
  }

  fetchLogs = async () => {
    const { accessToken } = await client.get("authentication");
    await fetch(`https://api.hype.lol/v1/vods/${this.vodId}/logs`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (response) => {
        return {
          status: response.status,
          arrayBuffer: await response.arrayBuffer(),
        };
      })
      .then(async (data) => {
        if (data.status >= 400) return this.setState({ logs: null });
        const UInt8ArrayBuffer = new Uint8Array(data.arrayBuffer);
        const decoder = new ZSTDDecoder();
        await decoder.init();
        const decompressedData = await decoder.decode(UInt8ArrayBuffer);
        const decompressedString = new TextDecoder("utf-8").decode(
          decompressedData
        );
        this.setState({ logs: decompressedString.split("\n") });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  getTwitchId = async () => {
    let twitchId;
    const { accessToken } = await client.get("authentication");
    await fetch(`https://api.hype.lol/v1/twitch/${this.channel}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) return console.error(data.msg);
        twitchId = data.twitchId;
      })
      .catch((e) => {
        console.error(e);
      });
    this.loadBadges();
    this.loadChannelBadges(twitchId);
    this.loadFFZEmotes(twitchId);
    this.loadBTTVGlobalEmotes(twitchId);
    this.loadBTTVChannelEmotes(twitchId);
  };

  loadBTTVGlobalEmotes = () => {
    fetch(`${this.BASE_BTTV_EMOTE_API}cached/emotes/global`, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        this.BTTVGlobalEmotes = data;
      })
      .catch((e) => {
        console.error(e);
      });
  };

  loadBTTVChannelEmotes = (twitchId) => {
    fetch(`${this.BASE_BTTV_EMOTE_API}cached/users/twitch/${twitchId}`, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        this.BTTVEmotes = data.sharedEmotes.concat(data.channelEmotes);
      })
      .catch((e) => {
        console.error(e);
      });
  };

  loadFFZEmotes = (twitchId) => {
    fetch(`${this.BASE_FFZ_EMOTE_API}room/id/${twitchId}`, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        this.FFZEmotes = data.sets[data.room.set].emoticons;
      })
      .catch((e) => {
        console.error(e);
      });
  };

  loadBadges = () => {
    fetch(this.BADGES_TWITCH_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        this.badgeSets = data.badge_sets;
      })
      .catch((e) => {
        console.error(e);
      });
  };

  loadChannelBadges = (twitchId) => {
    fetch(`${this.BASE_TWITCH_EMOTES_API}channels/${twitchId}`)
      .then((response) => response.json())
      .then((data) => {
        this.channelBadges = {
          subscriber: data.subscriber_badges,
          bits: data.bits_badges,
        };
      })
      .catch((e) => {
        console.error(e);
      });
  };

  handlePlayerReady = (player) => {
    this.player = player;
  };

  handlePlayerPlay = () => {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.setState(
        {
          chatLoading: true,
          comments: [],
          replayMessages: [],
          stoppedAtIndex: 0,
        },
        async () => {
          await this.fetchComments(this.player.getCurrentTime());
          this.loop();
        }
      );
    }, 1000);
  };

  loop = () => {
    this.loopTimeout = setTimeout(async () => {
      await this.buildChat();
      this.loop();
    }, 1000);
  };

  handlePlayerPause = () => {
    clearTimeout(this.loopTimeout);
  };

  componentWillUnmount() {
    clearTimeout(this.loopTimeout);
  }

  sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  fetchComments = async (offset) => {
    await fetch(
      `https://api.twitch.tv/v5/videos/${this.vodId}/comments?content_offset_seconds=${offset}`,
      {
        method: "GET",
        headers: {
          "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        },
      }
    )
      .then((response) => response.json())
      .then((data) => {
        let comments = [];
        for (let comment of data.comments) {
          if (comment.message.isAction) continue;
          if (Object.keys(comment.message.user_notice_params).length !== 0)
            continue; //don't display subs
          comments.push({
            id: comment._id,
            display_name: comment.commenter.display_name,
            created_at: comment.created_at,
            content_offset_seconds: comment.content_offset_seconds,
            message: comment.message.fragments,
            user_badges: comment.message.user_badges,
            user_color: comment.message.user_color,
          });
        }
        this.setState({ comments: comments, cursor: data._next });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  fetchNextComments = async () => {
    await fetch(
      `https://api.twitch.tv/v5/videos/${this.vodId}/comments?cursor=${this.state.cursor}`,
      {
        method: "GET",
        headers: {
          "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        },
      }
    )
      .then((response) => response.json())
      .then((data) => {
        let comments = [];
        for (let comment of data.comments) {
          if (comment.message.isAction) continue;
          if (Object.keys(comment.message.user_notice_params).length !== 0)
            continue; //don't display subs
          comments.push({
            id: comment._id,
            display_name: comment.commenter.display_name,
            created_at: comment.created_at,
            content_offset_seconds: comment.content_offset_seconds,
            message: comment.message.fragments,
            user_badges: comment.message.user_badges,
            user_color: comment.message.user_color,
          });
        }
        this.setState({
          comments: this.state.comments.concat(comments),
          cursor: data._next,
        });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  transformBadges = (badges) => {
    if (!badges) return null;
    let badgeWrapper = [];
    for (const badge of badges) {
      if (this.channelBadges) {
        const channelBadge = this.channelBadges[badge._id];
        if (channelBadge) {
          if (channelBadge[badge.version]) {
            badgeWrapper.push(
              <img
                key={this.badgesCount++}
                crossOrigin="anonymous"
                className={this.classes.badges}
                src={channelBadge[badge.version].image_url_1x}
                srcSet={`${channelBadge[badge.version].image_url_1x} 1x, ${
                  channelBadge[badge.version].image_url_2x
                } 2x, ${channelBadge[badge.version].image_url_4x} 4x`}
                alt=""
              />
            );
          }
          continue;
        }
      }

      const twitchBadge = this.badgeSets[badge._id];
      if (twitchBadge) {
        badgeWrapper.push(
          <img
            key={this.badgesCount++}
            crossOrigin="anonymous"
            className={this.classes.badges}
            src={`${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version].image_url_1x
            }`}
            srcSet={`${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version].image_url_1x
            } 1x, ${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version].image_url_2x
            } 2x, ${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version].image_url_4x
            } 4x`}
            alt=""
          />
        );
      }
    }

    return <span>{badgeWrapper}</span>;
  };

  transformMessage = (messageFragments) => {
    const textFragments = [];
    for (let messageFragment of messageFragments) {
      if (!messageFragment.emoticon) {
        let messageArray = messageFragment.text.split(" ");
        for (let message of messageArray) {
          let found;
          if (this.FFZEmotes) {
            for (let ffz_emote of this.FFZEmotes) {
              if (message === ffz_emote.name) {
                found = true;
                textFragments.push(
                  <div key={this.messageCount++} style={{ display: "inline" }}>
                    <img
                      crossOrigin="anonymous"
                      className={this.classes.chatEmote}
                      src={`https:${ffz_emote.urls["1"]}`}
                      srcSet={`https:${ffz_emote.urls["1"]} 1x, https:${ffz_emote.urls["2"]} 2x, https:${ffz_emote.urls["4"]} 4x`}
                      alt=""
                    />
                    {` `}
                  </div>
                );
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVGlobalEmotes) {
            for (let bttv_emote of this.BTTVGlobalEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                textFragments.push(
                  <div key={this.messageCount++} style={{ display: "inline" }}>
                    <img
                      className={this.classes.chatEmote}
                      src={`${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/1x`}
                      srcSet={`${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/1x 1x, ${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/2x 2x, ${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/3x 4x`}
                      alt=""
                    />
                    {` `}
                  </div>
                );
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVEmotes) {
            for (let bttv_emote of this.BTTVEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                textFragments.push(
                  <div key={this.messageCount++} style={{ display: "inline" }}>
                    <img
                      className={this.classes.chatEmote}
                      src={`${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/1x`}
                      srcSet={`${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/1x 1x, ${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/2x 2x, ${this.BASE_BTTV_CDN}emote/${bttv_emote.id}/3x 4x`}
                      alt=""
                    />
                    {` `}
                  </div>
                );
                break;
              }
            }
            if (found) continue;
          }

          //rest is just text
          textFragments.push(
            <span key={this.messageCount++}>{`${message} `}</span>
          );
        }
      } else {
        textFragments.push(
          <div key={this.messageCount++} style={{ display: "inline" }}>
            <img
              crossOrigin="anonymous"
              className={this.classes.chatEmote}
              src={`${this.BASE_TWITCH_CDN}emoticons/v1/${messageFragment.emoticon.emoticon_id}/1.0`}
              srcSet={
                messageFragment.emoticon.emoticon_set_id
                  ? `${this.BASE_TWITCH_CDN}emoticons/v1/${messageFragment.emoticon.emoticon_set_id}/1.0 1x, ${this.BASE_TWITCH_CDN}emoticons/v1/${messageFragment.emoticon.emoticon_set_id}/2.0 2x`
                  : ""
              }
              alt=""
            />
          </div>
        );
      }
    }
    return <span className="messages">{textFragments}</span>;
  };

  buildChat = async () => {
    if (this.state.comments.length === 0 || this.player.isPaused()) return;

    let pastIndex = this.state.comments.length - 1;
    for (
      let i = this.state.stoppedAtIndex.valueOf();
      i < this.state.comments.length;
      i++
    ) {
      const comment = this.state.comments[i];
      if (comment.content_offset_seconds > this.player.getCurrentTime()) {
        pastIndex = i;
        break;
      }
    }

    if (
      this.state.stoppedAtIndex === pastIndex &&
      this.state.stoppedAtIndex !== 0
    )
      return;

    let messages = this.state.replayMessages.slice(0);

    for (let i = this.state.stoppedAtIndex.valueOf(); i < pastIndex; i++) {
      if (messages.length > 30) {
        messages.splice(0, 1);
      }
      const comment = this.state.comments[i];
      messages.push(
        <li key={comment.id} style={{ width: "100%" }}>
          <Box
            alignItems="flex-start"
            display="flex"
            flexWrap="nowrap"
            width="100%"
            paddingLeft="0.5rem"
            paddingTop="0.5rem"
            paddingBottom="0.5rem"
          >
            <Box width="100%">
              <Box
                alignItems="flex-start"
                display="flex"
                flexWrap="nowrap"
                color="#fff"
              >
                <Box flexGrow={1}>
                  {this.transformBadges(comment.user_badges)}
                  <a
                    href={`https://twitch.tv/${comment.display_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#615b5b", textDecoration: "none" }}
                  >
                    <span
                      style={{ color: comment.user_color, fontWeight: "700" }}
                    >
                      {comment.display_name}
                    </span>
                  </a>
                  <Box display="inline">
                    <span>: </span>
                    {this.transformMessage(comment.message)}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </li>
      );
    }

    if (this.state.comments.length - 1 === pastIndex) {
      await this.fetchNextComments();
    }

    this.setState(
      {
        replayMessages: messages,
        stoppedAtIndex: pastIndex,
        chatLoading: false,
      },
      () => {
        this.chatRef.current.scrollTop = this.chatRef.current.scrollHeight;
      }
    );
  };

  render() {
    const { classes, user } = this.props;
    if (user === undefined || this.state.logs === undefined)
      return (
        <div className={classes.parent}>
          <div style={{ textAlign: "center" }}>
            <div>
              <img alt="" src={Logo} height="auto" width="15%" />
            </div>
            <CircularProgress style={{ marginTop: "2rem" }} size="3%" />
          </div>
        </div>
      );

    if (this.state.logs === null)
      return (
        <div className={classes.parent}>
          <div style={{ textAlign: "center" }}>
            <div>
              <img alt="" src={Logo} height="auto" width="15%" />
            </div>
            <Typography variant="h6" style={{ marginTop: "2rem" }}>
              This Vod has no Logs.
            </Typography>
          </div>
        </div>
      );

    return (
      <Container
        maxWidth={false}
        disableGutters
        style={{ height: "calc(100% - 48px)" }}
      >
        <Box display="flex" height="100%" width="100%">
          <TwitchPlayer
            id="twitch-player"
            className={classes.player}
            video={this.vodId}
            height="100%"
            width="100%"
            onPause={this.handlePlayerPause}
            onPlaying={this.handlePlayerPlay}
            onReady={this.handlePlayerReady}
          />
          <div className={classes.horizChat}>
            {this.state.chatLoading ? (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "20vh",
                }}
              >
                <CircularProgress style={{ marginTop: "2rem" }} size="15%" />
              </div>
            ) : (
              <SimpleBar
                scrollableNodeProps={{ ref: this.chatRef }}
                className={classes.scroll}
              >
                <div className={classes.chat}>
                  <Box
                    display="flex"
                    height="100%"
                    justifyContent="flex-end"
                    flexDirection="column"
                  >
                    <ul className={classes.ul}>{this.state.replayMessages}</ul>
                  </Box>
                </div>
              </SimpleBar>
            )}
          </div>
        </Box>
      </Container>
    );
  }
}

const useStyles = (theme) => ({
  parent: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  player: {
    height: "100%!important",
    width: "70%!important",
  },
  horizChat: {
    backgroundColor: "#0e0e10",
    width: "30%",
    height: "100%",
  },
  text: {
    marginTop: "1rem",
    color: "#fff",
  },
  chat: {
    height: "100%",
    backgroundColor: "#0e0e10",
    fontSize: "1rem",
    flex: "1 1 auto",
    lineHeight: "1rem",
    marginRight: ".2rem",
    overflowX: "hidden",
    overflowY: "auto",
  },
  scroll: {
    height: "100%",
  },
  ul: {
    minHeight: "0px",
    width: "calc(100% - 10px)",
    display: "flex",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  badges: {
    display: "inline-block",
    minWidth: "1rem",
    height: "1rem",
    margin: "0 .2rem .1rem 0",
    backgroundPosition: "50%",
    verticalAlign: "middle",
  },
  chatEmote: {
    verticalAlign: "middle",
    border: "none",
    maxWidth: "100%",
  },
});

export default withStyles(useStyles)(Vod);
