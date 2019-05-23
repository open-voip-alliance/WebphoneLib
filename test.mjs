import { SipLibClient } from './index.mjs';

const client = new SipLibClient({
  authorizationUser: 'jos.van.bakel@vialerapp.com',
  password: '',
  uri: '',
});

client.register().then(result => {
  console.log('client registered', result);
});
