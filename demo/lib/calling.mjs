import { Client, Media, Sound, log } from '../../dist/index.mjs';
import eventTarget from '../utils/eventTarget.mjs';
import * as CONF from '../config.mjs';
import { Logger } from './logging.mjs';
import {media} from './media.mjs';

const logger = new Logger('calling');
//TODO is this still necessary?
log.level = 'info';
log.connector = ({ level, context, message }) => {
  const print = {
    debug: console.debug,
    verbose: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }[level];

  print(`${level} [${context}] ${message}`);
};
//checkhcek

//console.log(process.env.authorizationUserId)

const account = {
  user: CONF.authorizationUserId,
  password: CONF.password,
  uri: CONF.accountUri,
  name: 'test'
};


const transport = {
  wsServers: `wss://websocket.${CONF.yourPlatformURL}`,
  iceServers: []
};

export let activeSession = null;
export const client = new Client({ account, transport, media, userAgentString: 'WebphoneLib Demo' });

export const callingEvents = eventTarget();

function onClientStatusUpdate(status) {
  logger.info(`Account status changed to ${status}`)
  callingEvents.dispatchEvent(new CustomEvent('clientStatusUpdate', {detail: {status}}));
}

export const subscriptions = {};
function onSubscriptionStatusUpdate(uri, status) {
  logger.debug(`onSubscriptionStatusUpdate: ${uri} - ${status}`);

  // Removing whitespaces from uri.
  const cleanedUri = uri.replace(/\s/g,'')
  subscriptions[cleanedUri] = status;
  subscriptionEvents.dispatchEvent(new CustomEvent(`notify-${cleanedUri}`, {detail: {status}}));
}

function onSessionsUpdated() {
  callingEvents.dispatchEvent(new CustomEvent('sessionsUpdated'));
}


export const subscriptionEvents = eventTarget();

export function registerAccount(){
  logger.info('Trying to register account.')
  client.on('statusUpdate', onClientStatusUpdate);
  client.on('subscriptionNotify', onSubscriptionStatusUpdate)
  client.on('sessionAdded', onSessionsUpdated);
  client.on('sessionRemoved', onSessionsUpdated);
  client.on('invite', onSessionsUpdated);
  client.connect()
  .then(async () =>{
    console.log('connected!')
  })
  .catch(e =>{
    logger.error(e);
    console.error(e)
  })
}

export function unregisterAccount(){
  logger.info('Trying to unregister account.')

  try{
    client.disconnect();
  }catch(e){
    logger.error(e);
    console.log(e);
  }
}

export function reconfigure(){
  logger.info('Trying to reconfigure account.')
  try{
    client.reconfigure({ account, transport });
  }catch(e){
    logger.error(e);
    console.log(e);
  }
}

export async function subscribe(uri) {
  try {
    return client.subscribe(uri);
  } catch(e) {
    logger.error(e);
  }

  subscriptions[uri] = 'unknown';
}

export function unsubscribe(uri) {
  subscriptionEvents.dispatchEvent(new CustomEvent(`remove-${uri}`));
  delete subscriptions[uri];
  return client.unsubscribe(uri);
}


// Placeholder until web-calling lib has implemented separate rejected promise
export function sessionAccepted(session) {
  return new Promise((resolve, reject) => {
    session
      .accepted()
      .then(({ accepted }) => {
        if (accepted) {
          resolve();
        }
      })
      .catch(() => reject());
  });
}

// Placeholder until web-calling lib has implemented separate rejected promise
export function sessionRejected(session) {
  return new Promise((resolve, reject) => {
    session
      .accepted()
      .then(({ accepted, rejectCause }) => {
        if (!accepted) {
          resolve({ rejectCause });
        }
      })
      .catch(() => reject());
  });
}


export async function invite(phoneNumber) {
  try{
    const session = await client.invite(`sip:${phoneNumber}@voipgrid.nl`).catch(logger.error);
    
    if (!session){
      return;
    }
  
    logger.info('placed an outgoing call');
  
    sessionAccepted(session).then(() => {
      logger.info('outgoing session is accepted', session.id);
      callingEvents.dispatchEvent(new CustomEvent('sessionUpdate'), {detail: session});
    });
  
    sessionRejected(session).then(({ rejectCause }) => {
      logger.info('outgoing session was rejected', session.id, 'because', rejectCause);
      callingEvents.dispatchEvent(new CustomEvent('sessionUpdate'), {detail: session});
    });
  
    session.terminated().finally(() => {
      logger.info('outgoing call was terminated', session.id);
      callingEvents.dispatchEvent(new CustomEvent('sessionUpdate'), {detail: session});
    });

    session.on('callQualityUpdate', (sessionId, stats) => {
      const {mos} = stats;
      callingEvents.dispatchEvent(new CustomEvent('changeMosValues', {detail: mos}));
    });

    return session;
  }catch(e){
    logger.error(e);
  }
}

export async function attendedTransfer(session, toSession) {
  return client.attendedTransfer(session, toSession);
}

export async function blindTransfer(session, phoneNumber) {
  return session.blindTransfer(`sip:${phoneNumber}@voipgrid.nl`);
}

export function getSessions() {
  if (client && client.isConnected()) {
    return client.getSessions();
  }
  return [];
}

export function getSession(id) {
  if (client && client.isConnected()) {
    return client.getSession(id);
  }
  return undefined;
}