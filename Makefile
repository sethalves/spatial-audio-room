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

clean:
	rm -rf examples/basic/dist
	rm -rf dist/ hifi-spatial-audio-3.0.0-0.tgz

very-clean: clean
	rm -rf node_modules package-lock.json
