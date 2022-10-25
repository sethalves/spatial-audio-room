#
#
#


WEBPACK=node_modules/.bin/webpack

all:
	rm -rf dist/
	mkdir -p dist/
	cp -r vendor dist/vendor
	tsc --declaration true
	cp assets/*.js dist/
	cp assets/*.svg dist/
	cp assets/*.ico dist/
	cp example/* dist/
	cp dist/transform.js dist/worker-transform.js
	sed -i 's/export //g' dist/worker-transform.js


docs:
	./node_modules/typedoc/bin/typedoc --readme src/README --name "High Fidelity Core Audio Engine SDK" --hideGenerator --disableSources --out dist/docs src/hifi-audio.ts src/hifi-transport.ts src/hifi-transport-agora.ts src/hifi-transport-p2p.ts
	cp doc-images/*.png dist/docs/

webpack-dev:
	${WEBPACK} --env buildEnv=dev
	tsc --declaration true # for transform.js
	cp dist/transform.js dist/worker-transform.js
	sed -i 's/export //g' dist/worker-transform.js

webpack:
	${WEBPACK} --env buildEnv=prod
	tsc --declaration true # for transform.js
	cp dist/transform.js dist/worker-transform.js
	sed -i 's/export //g' dist/worker-transform.js

deps:
	npm install webpack webpack-cli copy-webpack-plugin ts-loader --save-dev
	npm install agora-rtc-sdk-ng

install:
	rsync -avP --delete dist/ /var/www/html/audio-room/

clean:
	rm -rf dist
