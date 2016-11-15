all:

lint:
	@node_modules/.bin/eslint .

test:
	@node_modules/.bin/mocha

debugtest:
	# Run `node debug localhost:5858` to connect to the debugger when it stops.
	#
	# If you are using an older version of node, before node-inspector broke
	# (<6.2.0?), you can get a better UI by running
	# node_modules/.bin/node-inspector first, running `make debugtest`, then
	# opening http://127.0.0.1:8080/debug?port=5858 in Chrome.
	@node_modules/.bin/mocha -d

.PHONY: all lint test debugtest
