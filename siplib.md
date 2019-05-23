
# Table of Contents

1.  [Goals](#orga9f643b)
    1.  [SIPLib has clear error handling.](#org082cf76)
    2.  [.. does not keep state (which calls are open atm)?](#orgf969e60)
2.  [Use cases](#orgad5d247)
3.  [Accidental complexity](#org350db58)
4.  [SIPlib client setup](#orgd65e318)
5.  [Example flows](#orgfa02884)



<a id="orga9f643b"></a>

# Goals

Hide the complexities of SIP, SDP and WebRTC from the implementation
of the Webphone through an easy to use modern Javascript API.

Uses `Promises` and `async` where possible, use events only where
neccessary (not in request/response flows).


<a id="org082cf76"></a>

## SIPLib has clear error handling.


<a id="orgf969e60"></a>

## TODO .. does not keep state (which calls are open atm)?


<a id="orgad5d247"></a>

# Use cases

-   Register phone
-   Unregister phone
-   Accepting an incoming call
-   Denying an incoming call
-   Creating an outgoing call
-   Hanging up a call (in or out)
-   Putting a call on hold
-   Putting a call out of hold
-   Blind transfering a call
-   Attended transfer of call
-   Getting presence updates for contacts (blf)
-   Enter DTMF keys in a call
-   Muting a call?
-   Switching audio devices during a call?


<a id="org350db58"></a>

# Accidental complexity

-   Websocket connection to the SIP proxy.
    -   Connecting/disconnecting
    -   Handling failures

-   Setting up the WebRTC channels (SIP.js) does this.
-   Requesting the audio/video devices to be used (SIP.js)
    -   Is done by the SessionDescriptionHandler, maybe the audio stream
        handling could be decoupled from the SDH. Right now the SDH always
        does a `getUserMedia` call to get *a* microphone.
-   Negotiating the SDP (SIP.js).

-   Logging..
    -   Logging all SIP traffic?


<a id="orgd65e318"></a>

# SIPlib client setup

-   Which audio/video devices to use?
    -   *how to switch* a/v during a call? Is this possible?
-   ice servers (stun)
-   transport options (reconnection etc.?)
-   user agent
-   noanswertimeout?
-   etc.

Maybe best to first just pass through the `options` to the `SIP.UA`
constructor?


<a id="orgfa02884"></a>

# Example flows

    const client = new SipLibClient({
      proxy: 'websocket.voipgrid.nl',
    });
    
    await client.register({
      username: 'jos@vialerapp.com',
      password: 'xxxx',
    });
    
    sessions = {};
    client.on('invite', (session) => {
      sessions[session.id] = session;
      // reinvite..
      try {
        await session.accept();
        await sleep(1);
        await session.hold();
        await sleep(1);
        await session.blindTransfer({number: '456', name: 'Bob'});
      } catch (t) {
        if (state == accepted) await session.hold();
      } finally {
        delete sessions[session.id];
      }
    });
    
    const session = client.call({number: '123', name: 'Alice'});
    if (await session.active()) { // wait until the call is picked up)
      await session.dtmf('#123');
      await session.hold();
      const other = client.call({number: '456', name: 'Bob'});
      if (await other.active()) {
      }
      await session.transfer(other);
    }

