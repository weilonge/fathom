all:

run:
	node score.js

debug:
	node debug score.js

clean:
	rm -rf build

lint:
	node_modules/.bin/jshint score.js
