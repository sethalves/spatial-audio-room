#
#
#


WEBPACK=node_modules/.bin/webpack

all:
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

webpack:
	${WEBPACK} --env buildEnv=prod

deps:
	npm uninstall webpack webpack-cli copy-webpack-plugin ts-loader hifi-web-audio agora-rtc-sdk-ng typedoc
	rm -rf node_modules
	npm cache clean --force
	npm install webpack webpack-cli copy-webpack-plugin ts-loader --save-dev
	npm install hifi-web-audio@latest --registry https://npm.highfidelity.com/ --save-dev
	npm install agora-rtc-sdk-ng

install:
	rsync -avP --delete dist/ /var/www/html/audio-room/

clean:
	rm -rf dist
