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
