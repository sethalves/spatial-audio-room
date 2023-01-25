#
#
#


WEBPACK=node_modules/.bin/webpack

all: clean deps webpack install

sans-webpack:
	rm -rf dist/
	mkdir -p dist/
	cp -r vendor dist/vendor
	tsc --declaration true
	cp assets/*.svg dist/
	cp assets/*.ico dist/
	cp example/* dist/
	mkdir dist/sounds/
	cp sounds/*.wav dist/sounds/

webpack-dev:
	${WEBPACK} --env buildEnv=dev
	cp node_modules/hifi-web-audio/node_modules/hifi-audio-nodes/dist/hifi.wasm.js.map dist/
	cp node_modules/hifi-web-audio/node_modules/hifi-audio-nodes/dist/hifi-audio-nodes.js.map dist/
	cp node_modules/hifi-web-audio/node_modules/hifi-audio-nodes/dist/worker.js.map dist/
	cp node_modules/hifi-web-audio/node_modules/hifi-audio-nodes/dist/hifi.wasm.simd.js.map dist/
	cp node_modules/hifi-web-audio/dist/hifi-audio.js.map dist/

webpack:
	${WEBPACK} --env buildEnv=prod

deps:
	npm uninstall webpack webpack-cli copy-webpack-plugin ts-loader hifi-web-audio agora-rtc-sdk-ng typedoc
	rm -rf node_modules package-lock.json
	npm cache clean --force
	npm install webpack webpack-cli copy-webpack-plugin ts-loader --save-dev
	npm install @daily-co/daily-js
	npm install agora-rtc-sdk-ng --save-dev
	npm install hifi-web-audio@latest --registry https://npm.highfidelity.com/ --save-dev

#	npm --save install ../hifi-web-audio-api --save-dev

install:
	rsync -avP --delete dist/ /var/www/html/audio-room/

clean:
	rm -rf dist
	rm -f *~ */*~
