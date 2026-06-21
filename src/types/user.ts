export interface PatreonInfo {
  readonly isPatron: boolean;
  readonly tier: number;
  readonly tierName: string;
}

export interface WhitelistEntry {
  readonly id: string;
  readonly channel: string;
}

export interface User {
  readonly display_name: string;
  readonly patreon: PatreonInfo | null;
  readonly whitelists: WhitelistEntry[];
  readonly max_whitelist_channels: number;
  readonly admin: boolean;
  readonly whitelist: boolean;
}
