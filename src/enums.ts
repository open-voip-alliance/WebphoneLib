export enum ClientStatus {
  CONNECTING,
  CONNECTED,
  DYING, // (once you have a call and connectivity drops, your call is 'dying' for 1 minute)
  RECOVERING,
  DISCONNECTING,
  DISCONNECTED
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
