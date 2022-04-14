#
#
#

WEBSERVER=54.184.239.243

all: ts-library

ts-library:
	npm run build:node

web:
	npm run build:web
	rsync --delete -avP dist/ ubuntu@${WEBSERVER}:/var/www/html/basic-example/
	(cd examples/basic && npm run client && rsync -avP dist/ ubuntu@${WEBSERVER}:/var/www/html/basic-example/)

deps:
	npm install
	(cd examples/basic && npm install)

debug-deploy:
	rm -rf debug-dist
	mkdir -p debug-dist
	cp -r vendor debug-dist/vendor
	rm -rf dist
	tsc --declaration true
	cp -r dist/classes debug-dist/classes
	cp src/classes/patch-rtc-peer-connection.js debug-dist/classes
	cp examples/basic/src/index.js debug-dist/main.js
	cp examples/basic/src/canvas-control.js debug-dist/
	cp examples/basic/index.css debug-dist/
	cp examples/basic/index.html debug-dist/
	cp examples/basic/listener.svg debug-dist/
	cp examples/basic/sound.wav debug-dist/
	cp examples/basic/source.svg debug-dist/
	cp assets/WASMAudioBuffer.js debug-dist/
	cp assets/hifi.wasm.js debug-dist/
	cp assets/HifiProcessor.js debug-dist/
	rsync --delete -avP debug-dist/ /var/www/html/basic-example/

clean:
	rm -rf examples/basic/dist
	rm -rf dist/ debug-dist/ hifi-spatial-audio-3.0.0-0.tgz

very-clean: clean
	rm -rf node_modules package-lock.json
	rm -rf examples/basic/node_modules examples/basic/package-lock.json
