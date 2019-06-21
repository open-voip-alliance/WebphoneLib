export enum ClientStatus {
  CONNECTING,
  CONNECTED,
  DYING, // (once you have a call and connectivity drops, your call is 'dying' for 1 minute)
  RECOVERING,
  DISCONNECTING,
  DISCONNECTED
}
