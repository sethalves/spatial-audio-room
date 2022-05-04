#
#
#


WEBPACK=node_modules/.bin/webpack

all:
	rm -rf dist/
	mkdir -p dist/
	cp -r vendor dist/vendor
	tsc --declaration true


webpack-dev:
	${WEBPACK} --env buildEnv=dev

webpack:
	${WEBPACK} --env buildEnv=prod

deps:
	npm install webpack webpack-cli copy-webpack-plugin ts-loader --save-dev
	npm install agora-rtc-sdk-ng

install: all
	rsync -avP --delete dist/ /var/www/html/audio-room/

clean:
	rm -rf dist
