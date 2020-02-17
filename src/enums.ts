export enum ClientStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DYING = 'dying', // (once you have a call and connectivity drops, your call is 'dying' for 1 minute)
  RECOVERING = 'recovering',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected'
}

export enum SessionStatus {
  TRYING = 'trying',
  RINGING = 'ringing',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  TERMINATED = 'terminated'
}

export enum SubscriptionStatus {
  AVAILABLE = 'available',
  TRYING = 'trying',
  PROCEEDING = 'proceeding',
  EARLY = 'early',
  RINGING = 'ringing',
  CONFIRMED = 'confirmed',
  BUSY = 'busy',
  TERMINATED = 'terminated'
}

export enum ReconnectionMode {
  ONCE,
  BURST
}
