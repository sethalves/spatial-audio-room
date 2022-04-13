#
#
#

# WEBSERVER=54.184.239.243


all:
	npm run build:node

# npm run build:web

# upload: all
# 	scp dist/HighFidelityAudio-latest.js ubuntu@${WEBSERVER}:/var/www/html/
# 	scp HifiProcessor.js ubuntu@${WEBSERVER}:/var/www/html/


deps:
	npm install

clean:
	rm -rf dist/ hifi-spatial-audio-3.0.0-0.tgz

very-clean:
	rm -rf node_modules package-lock.json
