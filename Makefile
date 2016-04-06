all: build/score-bundle.js

build:
	mkdir -p build

build/score-bundle.js: build score.js
	node_modules/babel-cli/bin/babel.js score.js -o build/score-bundle.js

run: build/score-bundle.js
	node build/score-bundle.js

clean:
	rm -rf build

lint:
	node_modules/.bin/jshint score.js
