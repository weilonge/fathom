all:

run:
	node score.js

debug:
	node debug score.js

lint:
	node_modules/.bin/jshint score.js
