
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


## Development

### Install the dependencies

If developing using the published HiFi Web Audio API:
```
npm install
npm run install-audio-api
```

If developing using a local copy of the HiFi Web Audio API, build it alongside the demo source, then:
```
npm install
npm run install-local-audio-api
```

### Build the demo app


For production:
```
npm run build-app
```

For local development, with hot rebuild:
```
npm run watch-app
```

### Run the demo app when developing

Host the `/dist` directory on a Web server - e.g., add this directory as a virtual directory on localhost.

Load the demo app in a browser.

