all:

debug:
	@node_modules/.bin/node-debug fathom.js

lint:
	@node_modules/.bin/eslint .

test:
	@node_modules/.bin/mocha

debugtest:
	@node_modules/.bin/mocha -d
	# Run `node debug localhost:5858` to connect to the debugger when it stops.
	#
	# Better, run node_modules/.bin/node-inspector first, then run `make
	# debugtest`, then open http://127.0.0.1:8080/debug?port=5858 in Chrome.

.PHONY: all debug lint test
