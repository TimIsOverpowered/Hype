import React, { Component } from "react";
import client from "./client";
import {
  CircularProgress,
  Box,
  withStyles,
  Container,
  Typography,
} from "@material-ui/core";
import Logo from "./assets/logo.svg";
import { ZSTDDecoder } from "zstddec";
import SimpleBar from "simplebar-react";
import Settings from "./settings";
import Graph from "./graph";
import moment from "moment";
import Twitch from "./twitch.mjs";
import ReactPlayer from "react-player";
import Hls from "hls.js";
window.Hls = Hls;

class Vod extends Component {
  constructor(props) {
    super(props);

    this.BADGES_TWITCH_URL =
      "https://badges.twitch.tv/v1/badges/global/display?language=en";
    this.HYPE_API_URL = "https://api.hype.lol";
    this.BASE_TWITCH_CDN = "https://static-cdn.jtvnw.net/";
    this.BASE_FFZ_EMOTE_API = "https://api.frankerfacez.com/v1/";
    this.BASE_BTTV_EMOTE_API = "https://api.betterttv.net/3/";
    this.BASE_BTTV_CDN = "https://cdn.betterttv.net/";
    this.BASE_7TV_EMOTE_API = "https://api.7tv.app/v2/";
    this.BASE_7TV_CDN = "https://cdn.7tv.app/";
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
      replayMessages: [],
      comments: [],
      stoppedAtIndex: 0,
      volumeData: null,
      clipsData: null,
      chaptersData: null,
      interval: 30,
      graphData: null,
      messageGraphData: null,
      volumeGraphData: null,
      clipsGraphData: null,
      searchGraphData: null,
      messageThreshold: null,
      searchThreshold: 1,
      volumeThreshold: -40,
      searchToggle: false,
      volumeToggle: false,
      clipsToggle: false,
      start: "00:00:00",
      end: "00:00:00",
      searchTerm: "",
      variant: 0,
    };
  }

  componentDidMount() {
    document.title = `${this.channel} - ${this.vodId} - Hype`;
    if (!this.props.user) return;
    this.fetchLogs();
    this.fetchVolume();
    this.fetchClips();
    this.fetchChapters();
    this.getTwitchId();
    this.getM3u8();
  }

  fetchClips = async () => {
    const { accessToken } = await client.get("authentication");

    await fetch(`${this.HYPE_API_URL}/v1/vods/${this.vodId}/clips`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => response.json())
      .then(async (data) => {
        if (data.error) {
          return;
        }
        let newClips = [],
          index = 0;
        while (newClips.length !== data.length) {
          let tempClips = data.slice(index, index + 35);
          const mutatedClips = await this.mutateClips(tempClips);
          newClips = newClips.concat(mutatedClips);
          await this.sleep(1000);
          index += 35;
        }
        this.setState({ clipsData: newClips });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  mutateClips = async (clips) => {
    const gqlClips = [];
    for (let clip of clips) {
      gqlClips.push({
        operationName: "ClipsFullVideoButton",
        variables: {
          slug: clip.slug,
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash:
              "d519a5a70419d97a3523be18fe6be81eeb93429e0a41c3baa9441fc3b1dffebf",
          },
        },
      });
    }
    const gqlResponse = await this.getVideoOffsets(gqlClips);
    for (let i = 0; i < gqlResponse.length; i++) {
      clips[i].duration = moment
        .utc(gqlResponse[i].data.clip.videoOffsetSeconds * 1000)
        .format("HH:mm:ss");
    }
    return clips;
  };

  getVideoOffsets = async (gqlClips) => {
    let gqlResponse;
    await fetch(`https://gql.twitch.tv/gql`, {
      credentials: "omit",
      method: "POST",
      headers: {
        "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
      },
      body: JSON.stringify(gqlClips),
    })
      .then((response) => response.json())
      .then((data) => {
        gqlResponse = data;
      })
      .catch((e) => {
        console.error(e);
      });
    return gqlResponse;
  };

  fetchChapters = async () => {
    const { accessToken } = await client.get("authentication");

    await fetch(`${this.HYPE_API_URL}/v1/vods/${this.vodId}/chapters`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          return;
        }
        this.setState({ chaptersData: data });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  fetchVolume = async () => {
    const { accessToken } = await client.get("authentication");

    await fetch(`${this.HYPE_API_URL}/v1/vods/${this.vodId}/volume`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          return;
        }
        this.setState({ volumeData: data });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  fetchLogs = async () => {
    const { accessToken } = await client.get("authentication");
    await fetch(`${this.HYPE_API_URL}/v1/vods/${this.vodId}/logs`, {
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
    await fetch(`${this.HYPE_API_URL}/v1/twitch/${this.channel}`, {
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
    this.load7TVGlobalEmotes(twitchId);
    this.load7TVEmotes(twitchId);
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

  load7TVGlobalEmotes = () => {
    fetch(`${this.BASE_7TV_EMOTE_API}emotes/global`, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        this.SevenTVGlobalEmotes = data;
      })
      .catch((e) => {
        console.error(e);
      });
  };

  load7TVEmotes = (twitchId) => {
    fetch(`${this.BASE_7TV_EMOTE_API}users/${twitchId}/emotes`, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        this.SevenTVEmotes = data;
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
    fetch(`${this.HYPE_API_URL}/v1/badges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        twitchId: twitchId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        this.channelBadges = data;
      })
      .catch((e) => {
        console.error(e);
      });
  };

  handlePlayerReady = async (player) => {
    this.player = player;
    if (!this.state.logs)
      return this.setState({
        error:
          "There are no logs for this vod. This streamer may not be whitelisted..",
      });

    while (isNaN(player.getDuration())) {
      await this.sleep(50);
    }

    this.setState(
      {
        messageThreshold:
          Math.round(this.state.logs.length / player.getDuration()) * 25 || 1,
      },
      () => {
        this.buildMessageGraph();
      }
    );
  };

  handlePlayerSeek = (offset) => {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      if (this.state.comments.length > 0) {
        const lastComment = this.state.comments[this.state.comments.length - 1];
        const firstComment = this.state.comments[0];
        if (
          offset - lastComment.content_offset_seconds <= 30 &&
          offset > firstComment.content_offset_seconds
        ) {
          if (
            this.state.comments[this.state.stoppedAtIndex]
              .content_offset_seconds -
              offset >=
            4
          ) {
            this.setState(
              {
                stoppedAtIndex: 0,
                messages: [],
              },
              () => {
                this.loop();
              }
            );
            return;
          }
          this.loop();
          return;
        }
      }
      this.setState(
        {
          messages: [],
          comments: [],
          stoppedAtIndex: 0,
          chatLoading: true,
          cursor: null,
        },
        () => {
          this.fetchComments(offset);
          this.loop();
        }
      );
    }, 300);
  };

  handlePlayerStart = () => {
    let offset = Math.round(this.player.getCurrentTime());
    this.setState(
      {
        messages: [],
        comments: [],
        stoppedAtIndex: 0,
        chatLoading: true,
        cursor: null,
      },
      () => {
        this.fetchComments(offset);
        this.loop();
      }
    );
  };

  handlePlayerPlay = () => {
    this.setState({ paused: false }, () => {
      this.loop();
    });
  };

  loop = () => {
    if (this.loopTimeout) clearTimeout(this.loopTimeout);
    this.loopTimeout = setTimeout(async () => {
      await this.buildChat();
      this.loop();
    }, 1000);
  };

  handlePlayerPause = () => {
    this.setState({ paused: true });
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
        credentials: "omit",
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
          comments: comments,
          cursor: data._next,
          chatLoading: false,
        });
      })
      .catch((e) => {
        console.error(e);
      });
  };

  fetchNextComments = async () => {
    await fetch(
      `https://api.twitch.tv/v5/videos/${this.vodId}/comments?cursor=${this.state.cursor}`,
      {
        credentials: "omit",
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
      let foundBadge = false;
      if (this.channelBadges && this.channelBadges.length > 0) {
        for (let channelBadge of this.channelBadges) {
          if (badge._id !== channelBadge.set_id) continue;
          for (let badgeVersion of channelBadge.versions) {
            if (badgeVersion.id !== badge.version) continue;
            badgeWrapper.push(
              <img
                key={this.badgesCount++}
                crossOrigin="anonymous"
                className={this.props.classes.badges}
                src={badgeVersion.image_url_1x}
                srcSet={`${badgeVersion.image_url_1x} 1x, ${badgeVersion.image_url_2x} 2x, ${badgeVersion.image_url_4x} 4x`}
                alt=""
              />
            );
            foundBadge = true;
          }
        }
        if (foundBadge) continue;
      }

      const twitchBadge = this.badgeSets[badge._id];
      if (twitchBadge) {
        badgeWrapper.push(
          <img
            key={this.badgesCount++}
            crossOrigin="anonymous"
            className={this.props.classes.badges}
            src={`${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version]
                ? twitchBadge.versions[badge.version].image_url_1x
                : twitchBadge.versions[0].image_url_1x
            }`}
            srcSet={`${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version]
                ? twitchBadge.versions[badge.version].image_url_1x
                : twitchBadge.versions[0].image_url_1x
            } 1x, ${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version]
                ? twitchBadge.versions[badge.version].image_url_2x
                : twitchBadge.versions[0].image_url_2x
            } 2x, ${this.BASE_TWITCH_CDN}badges/v1/${
              twitchBadge.versions[badge.version]
                ? twitchBadge.versions[badge.version].image_url_4x
                : twitchBadge.versions[0].image_url_4x
            } 4x`}
            alt=""
          />
        );
      }
    }

    return <span>{badgeWrapper}</span>;
  };

  transformMessage = (messageFragments) => {
    if (messageFragments === null) return;
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
                      className={this.props.classes.chatEmote}
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
                      className={this.props.classes.chatEmote}
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
                      className={this.props.classes.chatEmote}
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

          if (this.SevenTVGlobalEmotes) {
            for (let stv_emote of this.SevenTVGlobalEmotes) {
              if (message === stv_emote.name) {
                found = true;
                textFragments.push(
                  <div key={this.messageCount++} style={{ display: "inline" }}>
                    <img
                      className={this.props.classes.chatEmote}
                      src={`${this.BASE_7TV_CDN}emote/${stv_emote.id}/1x`}
                      srcSet={`${this.BASE_7TV_CDN}emote/${stv_emote.id}/1x 1x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/2x 2x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/3x 3x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/4x 4x`}
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

          if (this.SevenTVEmotes) {
            for (let stv_emote of this.SevenTVEmotes) {
              if (message === stv_emote.name) {
                found = true;
                textFragments.push(
                  <div key={this.messageCount++} style={{ display: "inline" }}>
                    <img
                      className={this.props.classes.chatEmote}
                      src={`${this.BASE_7TV_CDN}emote/${stv_emote.id}/1x`}
                      srcSet={`${this.BASE_7TV_CDN}emote/${stv_emote.id}/1x 1x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/2x 2x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/3x 3x, ${this.BASE_7TV_CDN}emote/${stv_emote.id}/4x 4x`}
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

          textFragments.push(
            <span key={this.messageCount++}>{`${message} `}</span>
          );
        }
      } else {
        textFragments.push(
          <div key={this.messageCount++} style={{ display: "inline" }}>
            <img
              crossOrigin="anonymous"
              className={this.props.classes.chatEmote}
              src={`${this.BASE_TWITCH_CDN}emoticons/v2/${messageFragment.emoticon.emoticon_id}/default/dark/1.0`}
              srcSet={
                messageFragment.emoticon.emoticon_set_id
                  ? `${this.BASE_TWITCH_CDN}emoticons/v2/${messageFragment.emoticon.emoticon_set_id}/default/dark/1.0 1x, ${this.BASE_TWITCH_CDN}emoticons/v2/${messageFragment.emoticon.emoticon_set_id}/default/dark/2.0 2x`
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
    if (this.state.comments.length === 0 || this.state.paused) return;

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

    if (this.state.comments.length - 1 === pastIndex) {
      await this.fetchNextComments();
    }
    if (
      this.state.stoppedAtIndex === pastIndex &&
      this.state.stoppedAtIndex !== 0
    )
      return;

    let messages = this.state.replayMessages.slice(0);

    for (let i = this.state.stoppedAtIndex.valueOf(); i < pastIndex; i++) {
      const comment = this.state.comments[i];
      if (!comment.message) continue;
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
                  <div
                    style={{
                      color: "#615b5b",
                      textDecoration: "none",
                      display: "inline",
                    }}
                  >
                    <span
                      style={{ color: comment.user_color, fontWeight: "700" }}
                    >
                      {comment.display_name}
                    </span>
                  </div>
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
      if (messages.length > 75) messages.splice(0, 1);
    }

    this.setState(
      {
        replayMessages: messages,
        stoppedAtIndex: pastIndex,
      },
      () => {
        if (!this.chatRef.current) return;
        this.chatRef.current.scrollTop = this.chatRef.current.scrollHeight;
      }
    );
  };

  buildMessageGraph = () => {
    if (!this.state.logs)
      return this.setState({
        error:
          "There are no logs for this vod. This streamer may not be whitelisted..",
      });
    let data = [];
    const duration = this.player.getDuration();
    let logs = this.state.logs.slice(0),
      chapters = this.state.chaptersData;
    for (
      let seconds = this.state.interval.valueOf();
      seconds < duration;
      seconds += this.state.interval
    ) {
      let json = { emotes: {}, messages: 0 };

      if (chapters) {
        for (let chapter of chapters) {
          if (moment.duration(chapter.duration).asSeconds() <= seconds) {
            json.game = chapter.name;
          }
        }
      }
      for (let log of logs) {
        const timestampAsSeconds = moment
          .duration(log.substring(1, 9))
          .asSeconds();

        if (timestampAsSeconds > seconds) break;

        json.messages = json.messages + 1;

        const username = log.substring(
          log.indexOf("] ") + 2,
          log.indexOf(": ")
        );
        if (username === "twitchnotify") {
          json.subs = json.subs + 1 || 1;
        }

        const messageArray = log
          .substring(log.indexOf(": ") + 2, log.length)
          .trim()
          .split(" ");

        for (let message of messageArray) {
          let found;
          if (this.FFZEmotes) {
            for (let ffz_emote of this.FFZEmotes) {
              if (message === ffz_emote.name) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVGlobalEmotes) {
            for (let bttv_emote of this.BTTVGlobalEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVEmotes) {
            for (let bttv_emote of this.BTTVEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }
        }
      }
      logs.splice(0, json.messages);

      if (json.messages >= this.state.messageThreshold) {
        json.duration = moment.utc(seconds * 1000).format("HH:mm:ss");

        let sortable = [];

        for (let emoteKey of Object.keys(json.emotes)) {
          sortable.push([emoteKey, json.emotes[emoteKey]]);
        }

        delete json["emotes"];

        sortable.sort(function (a, b) {
          return b[1] - a[1];
        });

        if (sortable.length > 5) {
          sortable = sortable.slice(0, 5);
        }

        sortable.forEach((emote) => {
          json[emote[0]] = emote[1];
        });

        data.push(json);
      }
    }
    this.setState({
      graphData: data,
      messageGraphData: data,
      graphKey: "messages",
    });
  };

  handleIntervalChange = (evt) => {
    if (this.intervalTimeout) clearTimeout(this.intervalTimeout);
    this.intervalTimeout = setTimeout(() => {
      this.setState(
        {
          interval: parseInt(evt.target.value),
          searchGraphData: null,
          messageGraphData: null,
        },
        () => {
          this.state.searchToggle
            ? this.buildSearchGraph()
            : this.state.clipsToggle
            ? void 0
            : this.state.volumeToggle
            ? void 0
            : this.buildMessageGraph();
        }
      );
    }, 500);
  };

  handleChartClick = (evt) => {
    if (!evt) return;
    const duration = this.state.clipsToggle
      ? moment.duration(evt.activeLabel).asSeconds() - 5
      : moment.duration(evt.activeLabel).asSeconds() - this.state.interval;
    this.setState({
      start: moment.utc(duration * 1000).format("HH:mm:ss"),
      end: this.state.clipsToggle
        ? moment
            .utc((moment.duration(evt.activeLabel).asSeconds() + 25) * 1000)
            .format("HH:mm:ss")
        : evt.activeLabel,
      //(maybe add duration to label so its more accurate to the clip?)
    });
    this.setTimestamp(duration);
  };

  setTimestamp = (duration) => {
    if (this.state.paused) {
      this.setState({ paused: false });
      setTimeout(() => {
        this.player.seekTo(duration, "seconds");
      }, 50);
    } else {
      this.player.seekTo(duration, "seconds");
    }
    if (this.loopTimeout) clearTimeout(this.loopTimeout);
    if (this.timeout) clearTimeout(this.timeout);
  };

  handleSearchToggle = () => {
    const newValue = !this.state.searchToggle;
    this.setState({
      searchToggle: newValue,
      volumeToggle: false,
      clipsToggle: false,
      graphData: newValue
        ? this.state.searchGraphData
        : this.state.messageGraphData,
      graphKey: newValue ? this.state.searchTerm : "messages",
    });
  };

  handleVolumeToggle = () => {
    const newValue = !this.state.volumeToggle;
    this.setState(
      {
        volumeToggle: newValue,
        searchToggle: false,
        clipsToggle: false,
        graphData: newValue
          ? this.state.volumeGraphData
          : this.state.messageGraphData,
        graphKey: newValue ? "volume" : "messages",
      },
      () => {
        if (!this.state.volumeGraphData) {
          this.buildVolumeGraph();
        }
      }
    );
  };

  handleClipsToggle = () => {
    const newValue = !this.state.clipsToggle;
    this.setState(
      {
        clipsToggle: newValue,
        searchToggle: false,
        volumeToggle: false,
        graphData: newValue
          ? this.state.clipsGraphData
          : this.state.messageGraphData,
        graphKey: newValue ? "views" : "messages",
      },
      () => {
        if (!this.state.clipsGraphData) {
          this.buildClipsGraph();
        }
      }
    );
  };

  buildVolumeGraph = () => {
    if (!this.state.volumeData) return;

    let data = [];
    for (let volume of this.state.volumeData) {
      if (volume.volume > this.state.volumeThreshold) {
        data.push({
          duration: moment.utc(volume.duration * 1000).format("HH:mm:ss"),
          volume: volume.volume,
        });
      }
    }

    this.setState({
      volumeGraphData: data,
      graphData: data,
      graphKey: "volume",
    });
  };

  buildClipsGraph = () => {
    if (!this.state.clipsData) return;

    let data = [],
      chapters = this.state.chapters;
    for (let clip of this.state.clipsData) {
      let json = {
        duration: clip.duration,
      };
      if (chapters) {
        for (let chapter of chapters) {
          if (
            moment.duration(chapter.duration).asSeconds() <=
            moment.duration(clip.duration).asSeconds()
          ) {
            json.game = chapter.name;
          }
        }
      }
      json.title = clip.title;
      json.views = clip.views;
      json.url = clip.url;
      data.push(json);
    }

    this.setState({ clipsGraphData: data, graphData: data, graphKey: "views" });
  };

  buildSearchGraph = () => {
    if (this.state.searchTerm.length < 1) return;
    if (!this.state.logs)
      return this.setState({
        error:
          "There are no logs for this vod. This streamer may not be whitelisted..",
      });

    let data = [];
    const duration = this.player.getDuration();
    let logs = this.state.logs.slice(0),
      chapters = this.state.chapters;
    for (
      let seconds = this.state.interval.valueOf();
      seconds < duration;
      seconds += this.state.interval
    ) {
      let json = { emotes: {} };
      let searchMessages = 0,
        messages = 0,
        subs = 0;
      if (chapters) {
        for (let chapter of chapters) {
          if (moment.duration(chapter.duration).asSeconds() <= seconds) {
            json.game = chapter.name;
          }
        }
      }
      for (let log of logs) {
        const timestampAsSeconds = moment
          .duration(log.substring(1, 9))
          .asSeconds();

        if (timestampAsSeconds > seconds) break;
        messages++;

        const username = log.substring(
          log.indexOf("] ") + 2,
          log.indexOf(": ")
        );
        if (username === "twitchnotify") {
          subs++;
        }

        const messageArray = log
          .substring(log.indexOf(": ") + 2, log.length)
          .trim()
          .split(" ");
        for (let message of messageArray) {
          if (this.state.phrase) {
            if (
              message
                .toLowerCase()
                .includes(this.state.searchTerm.valueOf().toLowerCase())
            ) {
              searchMessages++;
            }
          } else {
            if (
              message.toLowerCase() ===
              this.state.searchTerm.valueOf().toLowerCase()
            ) {
              searchMessages++;
            }
          }

          let found;
          if (this.FFZEmotes) {
            for (let ffz_emote of this.FFZEmotes) {
              if (message === ffz_emote.name) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVGlobalEmotes) {
            for (let bttv_emote of this.BTTVGlobalEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.BTTVEmotes) {
            for (let bttv_emote of this.BTTVEmotes) {
              if (message === bttv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.SevenTVGlobalEmotes) {
            for (let stv_emote of this.SevenTVGlobalEmotes) {
              if (message === stv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }

          if (this.SevenTVEmotes) {
            for (let stv_emote of this.SevenTVEmotes) {
              if (message === stv_emote.code) {
                found = true;
                json.emotes[message] = json.emotes[message] + 1 || 1;
                break;
              }
            }
            if (found) continue;
          }
        }
      }
      logs.splice(0, messages);

      if (searchMessages >= this.state.searchThreshold) {
        json.duration = moment.utc(seconds * 1000).format("HH:mm:ss");
        json[`${this.state.searchTerm}`] = searchMessages;
        json.messages = messages;
        if (subs > 0) {
          json.subs = subs;
        }

        let sortable = [];

        for (let emoteKey of Object.keys(json.emotes)) {
          sortable.push([emoteKey, json.emotes[emoteKey]]);
        }

        delete json["emotes"];

        sortable.sort(function (a, b) {
          return b[1] - a[1];
        });

        if (sortable.length > 5) {
          sortable = sortable.slice(0, 5);
        }

        sortable.forEach((emote) => {
          json[emote[0]] = emote[1];
        });

        data.push(json);
      }
    }

    this.setState({
      searchGraphData: data,
      graphData: data,
      graphKey: this.state.searchTerm,
    });
  };

  handleSearchThreshold = (evt) => {
    const value = parseInt(evt.target.value);
    if (isNaN(value)) return;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.setState({ searchThreshold: value }, () => {
        this.buildSearchGraph();
      });
    }, 500);
  };

  handleVolumeThreshold = (evt) => {
    const value = parseInt(evt.target.value);
    if (isNaN(value)) return;
    if (this.volumeTimeout) clearTimeout(this.volumeTimeout);
    this.volumeTimeout = setTimeout(() => {
      this.setState({ volumeThreshold: value }, () => {
        this.buildVolumeGraph();
      });
    }, 500);
  };

  handleMessageThreshold = (evt) => {
    const value = parseInt(evt.target.value);
    if (isNaN(value)) return;
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      this.setState({ messageThreshold: value }, () => {
        this.buildMessageGraph();
      });
    }, 500);
  };

  handleStartInput = (evt) => {
    this.setState({ start: evt.target.value });
  };

  handleEndInput = (evt) => {
    this.setState({ end: evt.target.value });
  };

  handleStartButton = () => {
    if (!this.player) return;
    this.setState({
      start: moment.utc(this.player.getCurrentTime() * 1000).format("HH:mm:ss"),
    });
  };

  handleEndButton = () => {
    if (!this.player) return;
    this.setState({
      end: moment.utc(this.player.getCurrentTime() * 1000).format("HH:mm:ss"),
    });
  };

  handleClip = () => {
    if (!this.player) return;

    const startMoment = moment(this.state.start, "HH:mm:ss", true);
    const endMoment = moment(this.state.end, "HH:mm:ss", true);

    if (!startMoment.isValid() || !endMoment.isValid())
      return alert("Invalid input. Please format as HH:mm:ss", "Hype");

    if (startMoment.isSameOrAfter(endMoment))
      return alert(
        "Invalid input. Start Timestamp is (the same as or after) End Timestamp",
        "Hype"
      );

    window.api.send("clip", {
      vodId: this.vodId,
      start: this.state.start,
      end:
        moment.duration(this.state.end).asSeconds() -
        moment.duration(this.state.start).asSeconds(),
    });
  };

  handleVariantInput = (evt) => {
    this.setState({
      variant: parseInt(evt.target.value),
    });
  };

  handleDownloadVod = () => {
    window.api.send("vod", {
      vodId: this.vodId,
      variant: this.state.variant,
    });
  };

  handleSearchInput = (evt) => {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.setState({ searchTerm: evt.target.value }, () => {
        this.buildSearchGraph();
      });
    }, 500);
  };

  getM3u8 = async () => {
    const vodTokenSig = await Twitch.gqlGetVodTokenSig(this.vodId);
    const m3u8 = Twitch.getParsedM3u8(
      await Twitch.getM3u8(this.vodId, vodTokenSig.value, vodTokenSig.signature)
    );
    this.setState({ source: m3u8 });
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
            <CircularProgress style={{ marginTop: "2rem" }} size="1rem" />
          </div>
        </div>
      );

    return (
      <Container
        maxWidth={false}
        disableGutters
        style={{
          height: "calc(100% - 48px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box display="flex" height="50%" width="100%">
          <ReactPlayer
            className={classes.player}
            playing={!this.state.paused}
            url={this.state.source}
            controls={true}
            muted={false}
            width="100%"
            height="100%"
            onReady={this.handlePlayerReady}
            onStart={this.handlePlayerStart}
            onPlay={this.handlePlayerPlay}
            onPause={this.handlePlayerPause}
            onSeek={this.handlePlayerSeek}
          />
          <div className={classes.horizChat}>
            {this.state.chatLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <CircularProgress size="3rem" />
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
        <Settings
          player={this.player}
          volumeData={this.state.volumeData}
          clipsData={this.state.clipsData}
          handleIntervalChange={this.handleIntervalChange}
          handleSearchToggle={this.handleSearchToggle}
          handleClipsToggle={this.handleClipsToggle}
          handleVolumeToggle={this.handleVolumeToggle}
          handleMessageThreshold={this.handleMessageThreshold}
          handleVolumeThreshold={this.handleVolumeThreshold}
          handleSearchThreshold={this.handleSearchThreshold}
          handleStartInput={this.handleStartInput}
          handleEndInput={this.handleEndInput}
          handleStartButton={this.handleStartButton}
          handleEndButton={this.handleEndButton}
          handleClip={this.handleClip}
          messageThreshold={this.state.messageThreshold}
          volumeThreshold={this.state.volumeThreshold}
          searchThreshold={this.state.searchThreshold}
          interval={this.state.interval}
          start={this.state.start}
          end={this.state.end}
          searchToggle={this.state.searchToggle}
          volumeToggle={this.state.volumeToggle}
          clipsToggle={this.state.clipsToggle}
          handleSearchInput={this.handleSearchInput}
          searchTerm={this.searchTerm}
          handleVariantInput={this.handleVariantInput}
          handleDownloadVod={this.handleDownloadVod}
          variant={this.state.variant}
        />

        {!this.state.graphData ? (
          !this.state.logs ? (
            <div className={classes.graphRoot}>
              <div className={classes.graphLoading}>
                <Typography variant="h5">{this.state.error}</Typography>
              </div>
            </div>
          ) : (
            <div className={classes.graphRoot}>
              <div className={classes.graphLoading}>
                <CircularProgress size="3rem" />
              </div>
            </div>
          )
        ) : (
          <Graph
            data={this.state.graphData}
            handleChartClick={this.handleChartClick}
            graphKey={this.state.graphKey}
          />
        )}
      </Container>
    );
  }
}

const useStyles = () => ({
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
    backgroundColor: "rgb(14 14 14 / 1)",
    width: "30%",
    height: "100%",
  },
  text: {
    marginTop: "1rem",
    color: "#fff",
  },
  chat: {
    height: "100%",
    backgroundColor: "rgb(14 14 14 / 1)",
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
  graphRoot: {
    flex: 1,
  },
  graphLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
});

export default withStyles(useStyles)(Vod);
