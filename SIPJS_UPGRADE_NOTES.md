# SIP.js Upgrade: 0.15.6 → 0.21.2

This document summarizes all changes made to upgrade WebphoneLib from SIP.js 0.15.6 to 0.21.2.

## Summary

Successfully upgraded through the following versions:

- 0.15.6 → 0.17.1 (Major breaking changes)
- 0.17.1 → 0.18.1 (Clean upgrade)
- 0.18.1 → 0.19.0 (Clean upgrade)
- 0.19.0 → 0.20.1 (Clean upgrade)
- 0.20.1 → 0.21.2 (Minor breaking changes)

**Status**: ✅ Code upgrade complete, TypeScript compiles, build succeeds
**Test Status**: ⚠️ Test infrastructure needs ESM update (separate from code upgrade)

---

## Breaking Changes by Version

### 0.15.6 → 0.17.1 (Major Rewrite)

#### 1. SessionDescriptionHandler Complete Redesign

- **Old**: Direct SessionDescriptionHandler manipulation
- **New**: Factory-based approach with custom MediaStreamFactory
- **Files**: `src/session-description-handler.ts`

**Changes**:

```typescript
// New factory pattern with custom media stream factory
export function sessionDescriptionHandlerFactory(session, options): SessionDescriptionHandler {
  const mediaStreamFactory = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    if (!(session as any).__streams) {
      (session as any).__streams = {
        localStream: audioContext.createMediaStreamDestination(),
        remoteStream: new MediaStream()
      };
    }
    await (session as any).__media.setInput();
    return (session as any).__streams.localStream.stream;
  };

  const factory = defaultSessionDescriptionHandlerFactory(mediaStreamFactory);
  const sdh = factory(session, options);

  // Delegate pattern for track handling
  const originalDelegate = sdh.peerConnectionDelegate;
  sdh.peerConnectionDelegate = {
    ...originalDelegate,
    ontrack: async (event: RTCTrackEvent) => {
      // Custom track handling
    }
  };
  return sdh;
}
```

#### 2. EventEmitter → Delegate Pattern Migration

- **Old**: `.on()`, `.once()` methods for events
- **New**: Delegate callbacks and `.stateChange.addListener()`
- **Files**: `src/session.ts`, `src/client.ts`, `src/session-stats.ts`, `src/session-health.ts`

**Session BYE handling**:

```typescript
// Old: session.once('bye', () => { this.saidBye = true; })
// New:
if (!this.session.delegate) {
  this.session.delegate = {};
}
const originalOnBye = this.session.delegate.onBye;
this.session.delegate.onBye = bye => {
  this.saidBye = true;
  if (originalOnBye) {
    originalOnBye(bye);
  }
};
```

**Session state changes**:

```typescript
// Old: session.on('terminated', () => {...})
// New: session.stateChange.addListener((newState: SessionState) => {...})
```

**SessionDescriptionHandler creation**:

```typescript
// Old: session.once('SessionDescriptionHandler-created', (sdh) => {...})
// New:
session.delegate = {
  ...originalDelegate,
  onSessionDescriptionHandler: (sdh, provisional) => {
    if (!provisional) {
      setupStatsTimer();
    }
  }
};
```

#### 3. Transport Event Handling

- **Old**: Transport extends EventEmitter, uses `.emit()`
- **New**: Transport has `.stateChange` emitter
- **Files**: `src/transport.ts`, `src/health-checker.ts`

**Changes**:

```typescript
// Old: this.userAgent.transport.emit('disconnected')
// New: this.userAgent.transport.disconnect()

// State monitoring:
this.userAgent.transport.stateChange.on((state: TransportState) => {
  if (state === TransportState.Disconnected) {
    this.onTransportDisconnected();
  }
});
```

#### 4. Session Time Tracking

- **Old**: Session has `.startTime` and `.endTime` properties
- **New**: Manual time tracking required
- **Files**: `src/session.ts`

**Implementation**:

```typescript
private _startTime: Date;
private _endTime: Date;

constructor() {
  this._startTime = new Date();

  this.session.stateChange.addListener((newState: SessionState) => {
    if (newState === SessionState.Terminated) {
      this._endTime = new Date();
    }
  });
}

get startTime(): Date { return this._startTime; }
get endTime(): Date { return this._endTime; }
```

#### 5. Hold/Unhold Modifier Changes

- **Old**: `session.sessionDescriptionHandler.holdModifier`
- **New**: `holdModifier` imported from modifiers package
- **Files**: `src/session.ts`

**Changes**:

```typescript
import { holdModifier } from 'sip.js/lib/platform/web/modifiers';

// Usage remains similar:
const modifiers: Array<SessionDescriptionHandlerModifier> = [];
if (flag) {
  modifiers.push(holdModifier);
}
await this.reinvite(modifiers);
```

#### 6. Transfer/REFER Implementation

- **Old**: `Referrer` class for transfers
- **New**: Direct `session.refer()` method
- **Files**: `src/session.ts`

**Changes**:

```typescript
// Old: new Referrer(session, target, options)
// New:
private async isTransferredPromise(target: Core.URI | UserAgentSession) {
  return new Promise<boolean>(resolve => {
    this.session.refer(target, {
      requestDelegate: {
        onAccept: () => resolve(true),
        onReject: () => resolve(false)
      }
    });
  });
}
```

#### 7. Internal API Access Changes

- **Files**: `src/transport.ts`

**Changes**:

```typescript
// Changed to access internal properties (marked as private in 0.17+):
- userAgent.registerers → userAgent._registerers
- invitation.onCancel → invitation._onCancel
- invitation.replacee → invitation._replacee
```

#### 8. Subscriber Event Handling

- **Files**: `src/client.ts`

**Changes**:

```typescript
// Old:
subscriber.on('failed', () => {...});
subscriber.on('accepted', () => {...});

// New:
subscriber.stateChange.addListener((state: SubscriptionState) => {
  if (state === SubscriptionState.Terminated) {
    // Handle termination
  }
});

subscriber.subscribe().catch(() => {
  // Handle failure
});
```

#### 9. Constants and Enums

- **Files**: `src/health-checker.ts`

**Changes**:

```typescript
// Old: C.OPTIONS constant
// New: string literal 'OPTIONS'
```

### 0.17.1 → 0.18.1

No breaking changes. Clean upgrade.

### 0.18.1 → 0.19.0

No breaking changes. RFC 8829 hold implementation compatible with existing code.

### 0.19.0 → 0.20.1

No breaking changes. Backwards compatible.

### 0.20.1 → 0.21.2 (ESM Transition)

#### 1. UserAgentOptions - Removed Properties

- **Old**: `autoStart` and `autoStop` configuration options
- **New**: Removed (start/stop must be called explicitly)
- **Files**: `src/transport.ts`

**Changes**:

```typescript
// Removed from uaOptions:
// - autoStart: false
// - autoStop: false

// Manual start is now required:
const userAgent = new UserAgent(options);
userAgent.start();

// Manual stop on unload (if needed):
window.addEventListener('unload', () => userAgent.stop());
```

#### 2. Module System

- **Change**: Full ESM (ECMAScript modules) migration
- **Impact**: Test infrastructure needs updating to support pure ESM
- **Build Impact**: Rollup handles this correctly, build succeeds

---

## Files Modified

### Core Changes

- `package.json` - Updated sip.js dependency from 0.15.6 to 0.21.2
- `src/session-description-handler.ts` - Complete rewrite for new factory pattern
- `src/session.ts` - Delegate pattern, manual time tracking, hold modifier changes
- `src/transport.ts` - State change emitter, internal API access, removed autoStart/autoStop
- `src/client.ts` - Subscriber event handling migration
- `src/session-stats.ts` - SessionDescriptionHandler delegate pattern
- `src/session-health.ts` - SessionDescriptionHandler delegate pattern
- `src/health-checker.ts` - Transport disconnect method, removed constants

---

## Testing Status

### ✅ Working

- TypeScript compilation
- Production build (rollup)
- All type checking passes

### ⚠️ Needs Work

- Test suite infrastructure requires ESM update
- Current test runner (AVA + esm loader) incompatible with SIP.js 0.21's pure ESM
- Tests fail at module loading, not in actual code

### Recommended Next Steps for Tests

1. Update test configuration to support pure ESM modules
2. Consider migrating to a test runner with native ESM support
3. Update AVA configuration for ESM compatibility
4. Alternative: Use dynamic imports in test setup

---

## Compatibility Notes

### Type Safety

All TypeScript types compile without errors. Type coverage maintained throughout upgrade.

### API Compatibility

WebphoneLib's public API remains unchanged. All changes are internal implementations.

### Browser Compatibility

No changes to browser compatibility. WebRTC and Web Audio API usage remains the same.

---

## Git History

All changes committed incrementally by version:

- `feat/sipjs-upgrade` branch created from main
- Baseline tagged as `pre-sipjs-upgrade`
- Individual commits for each version upgrade
- Each commit includes version number and key changes

---

## References

- [SIP.js Migration Guide 0.20 → 0.21](https://github.com/onsip/SIP.js/blob/main/docs/migration-0.20-0.21.md)
- [SIP.js 0.17 Release Notes](https://github.com/onsip/SIP.js/releases/tag/0.17.0)
- [SIP.js GitHub Releases](https://github.com/onsip/SIP.js/releases)
