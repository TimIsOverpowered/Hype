export interface PlayerSettings {
  volume: number;
  muted: boolean;
}

export interface ChatSettings {
  chatWidth: number;
  showTimestamp: boolean;
  chatOnLeft: boolean;
  fontFamily: string;
  messageFontSize: number;
}

export interface ChatRenderSettings {
  width: number;
  height: number;
  fps: number;
  transparentBackground: boolean;
  backgroundColor: string;
  fontFamily: string;
  fontColor: string;
  fontSize: number;
  showBadges: boolean;
  enableBttv: boolean;
  enableFfz: boolean;
  enable7tv: boolean;
  ignoredUsers: string;
  bannedWords: string;
}
