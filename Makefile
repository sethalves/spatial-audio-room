#
#
#


WEBPACK=node_modules/.bin/webpack



all:
	${WEBPACK} --env buildEnv=dev

prod:
	${WEBPACK} --env buildEnv=prod

deps:
	npm install webpack webpack-cli copy-webpack-plugin ts-loader --save-dev
	npm install agora-rtc-sdk-ng

install: all
	rsync -avP --delete dist/ /var/www/html/audio-room/

clean:
	rm -rf dist
