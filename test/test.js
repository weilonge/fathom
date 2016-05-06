const assert = require('chai').assert;
const jsdom = require('../node_modules/jsdom');

const fathom = require('../fathom');
const ruleset = fathom.ruleset, rule = fathom.rule, dom = fathom.dom;


describe('Ranker', function() {
    describe('simple DOM rule', function () {
        it('should score its node and insert an empty scribble', function () {
            var doc = jsdom.jsdom(`
                <p>
                    <a class="good" href="https://github.com/tmpvar/jsdom">jsdom!</a>
                    <a class="bad" href="https://github.com/tmpvar/jsdom">jsdom!</a>
                </p>`
            );
            var rules = ruleset(
                rule(dom('a[class=good]'), node => ([{scoreMultiplier: 2, type: 'anchor'}]))
            );
            var kb = rules.score(doc);
            var node = kb.nodeForElement(doc.querySelectorAll('a[class=good]')[0]);
            assert.equal(node.score, 2);
            assert.equal(node.types.get('anchor'), undefined);
        });
    });
});
