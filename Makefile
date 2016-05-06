all:

run:
	node score.js

debug:
	node_modules/.bin/node-debug score.js

lint:
	node_modules/.bin/jshint score.js

test:
	node_modules/.bin/mocha

.PHONY: all run debug lint test
