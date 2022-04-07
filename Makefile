#
#
#

WEBSERVER=54.184.239.243


all:
	npm run build:web

upload: all
	scp dist/HighFidelityAudio-latest.js ubuntu@${WEBSERVER}:/var/www/html/
	scp HifiProcessor.js ubuntu@${WEBSERVER}:/var/www/html/
