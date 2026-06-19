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

export interface GraphSettings {
  messageThreshold: number | null;
  searchThreshold: number | null;
}
