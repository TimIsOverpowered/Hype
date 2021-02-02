import React from 'react';
import { TwitchPlayer } from "react-twitch-embed";

/** Needed to fix infinite reload when supplying parent prop */

export default class Player extends React.PureComponent {
  render() {
    const {
      vodId,
      handlePlayerPause,
      handlePlayerPlay,
      handlePlayerReady,
    } = this.props;
    return (
      <TwitchPlayer
        id="twitch-player"
        video={vodId}
        height="100%"
        width="100%"
        parent={["hype.lol"]}
        onPause={handlePlayerPause}
        onPlaying={handlePlayerPlay}
        onReady={handlePlayerReady}
      />
    );
  }
}