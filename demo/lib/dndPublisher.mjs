import * as CONF from '../config.mjs';

let publisher;

function getOrCreatePublisher(client, contact, options) {
  if (!publisher) {
    try {
      publisher = client.createPublisher(contact, options);
    } catch (e) {
      console.error(e);
    }

    let lastPubRequestEtag = localStorage.getItem('last_pub_request_etag');
    if (lastPubRequestEtag) {
      publisher.pubRequestEtag = lastPubRequestEtag;
    }

    const receiveResponse = publisher.receiveResponse.bind(publisher);

    // Wrap the receiveResponse so we can secretly store a tag which we can
    // use to override the dnd publish message associated with our last publish.
    publisher.receiveResponse = response => {
      receiveResponse(response);

      if (publisher && publisher.pubRequestEtag !== lastPubRequestEtag) {
        lastPubRequestEtag = publisher.pubRequestEtag;
        localStorage.setItem('last_pub_request_etag', lastPubRequestEtag);
      }
    };
  }

  return publisher;
}

export function updateDndPublisher(client, account, enabled) {
  // Avoid creating a publisher when we don't need one.
  if ((!publisher && !enabled) || !account) {
    return;
  }

  const sipAccount = `sip:${account}@${CONF.realm}`;

  publisher = getOrCreatePublisher(client, sipAccount, {
    body: 'dnd',
    contentType: 'application/dialog-info+xml',
    expires: 120
  });

  if (enabled) {
    //TODO the call id is wrong and needs fixing.
    publisher.publish(
      `<?xml version="1.0"?><dialog-info xmlns="urn:ietf:params:xml:ns:dialog-info" state="partial" entity="${account.uri}"><dialog id="${publisher.request.callId}" call-id="${publisher.request.callId}" direction="recipient"><state>dnd</state><remote><identity>${account.uri}</identity><target uri="${account.uri}"/></remote><local><identity>${account.uri}</identity><target uri="${account.uri}"/></local></dialog></dialog-info>`
    );
  } else {
    publisher.unpublish();
  }
}

export function removeDndPublisher() {
  publisher = undefined;
  localStorage.removeItem('last_pub_request_etag');
}
