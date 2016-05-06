all:

debug:
	node_modules/.bin/node-debug fathom.js

lint:
	node_modules/.bin/jshint fathom.js

test:
	node_modules/.bin/mocha

.PHONY: all debug lint test
