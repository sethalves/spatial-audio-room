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

clean:
	rm -rf dist
