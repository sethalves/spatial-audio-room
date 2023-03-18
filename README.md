
# HiFi Spatial Audio Room Demo


## Prerequisites

### Node.js

https://nodejs.org/en/download/

**node** version 18 

**npm** version 8

### Source

Make a local copy of the HiFi Spatial Audio Room repo:
```
git clone https://github.com/highfidelity/spatial-audio-room-demo.git
```

### Token server

A *HiFi Agora Token Server* - either the URL of an existing one or set up and run a copy for the demo app to use.



## Development

### Install the dependencies

Install the dependencies:
```
npm install
```

If developing using a local copy of the *HiFi Web Audio API*, build it alongside the demo source, then:
```
npm run install-local-audio-api
```

### Configure the demo app

Make a copy of `/example/config.template.js` as `/example/config.js`.

Edit this `config.js` file:

- Configure the transport to use: Agora, Daily, or P2P.
- Set the channel prefix to use. Users join an audio channel named `<channel prefix>:<room name>` (e.g., 
`hifi-demo:room-conf-table`).
- If using Daily as the transport, set `DAILY_URL` to be your Daily account URL.
- If using a non-default token server, set the `TOKEN_SERVER` address.
- Enable the "Music" room if wanted.


### Build the demo app

For production:
```
npm run build
```

For local development, with hot rebuild:
```
npm run watch
```

### Run the demo app

Host the `/dist` directory on a Web server - either public or localhost.

If the `CHANNEL_PREFIX` hasn't been configured, it is recommended that you host the app at one of the following paths:
```
http://<domain>/snap
http://<domain>/crackle
http://<domain>/pop
```

If you've configured a token server, ensure that it's running.

Load the demo app in a browser.
