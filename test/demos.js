const assert = require('chai').assert;
const jsdom = require('jsdom');

const {dom, rule, ruleset} = require('../fathom');


describe('Design-driving demos', function() {
    it('Handles a simple series of short-circuiting rules', function () {
        // TODO: Short-circuiting isn't implemented yet. The motivation here is
        // to inspire changes to ranker functions that make them more
        // declarative, such that the engine can be smart enough to run the
        // highest-possible-scoring flavor-chain of rules first and, if it
        // succeeds, omit the others.
        const doc = jsdom.jsdom(`
            <meta name="hdl" content="HDL">
            <meta property="og:title" content="OpenGraph">
            <meta property="twitter:title" content="Twitter">
            <title>Title</title>
        `);
        const rules = ruleset(
            rule(dom('meta[property="og:title"]'),
                 node => [{scoreMultiplier: 40, flavor: 'titley', notes: node.element.content}]),
            rule(dom('meta[property="twitter:title"]'),
                 node => [{scoreMultiplier: 30, flavor: 'titley', notes: node.element.content}]),
            rule(dom('meta[name="hdl"]'),
                 node => [{scoreMultiplier: 20, flavor: 'titley', notes: node.element.content}]),
            rule(dom('title'),
                 node => [{scoreMultiplier: 10, flavor: 'titley', notes: node.element.text}])
        );
        const kb = rules.score(doc);
        // TODO: Design a max() yanker, and use it here instead of nodeForElement().
        const node = kb.nodeForElement(doc.querySelectorAll('meta[property="og:title"]')[0]);
        assert.equal(node.score, 40);
        assert.equal(node.flavors.get('titley'), 'OpenGraph');
    });

    it("takes a decent shot at doing Readability's job");
    // HACK: We shouldn't ignore unused code.
    function piecesOfTheReadabilityTestCase() { // eslint-disable-line no-unused-vars
        const map = require('lodash/map');
        const sum = require('lodash/sum');

        const doc = jsdom.jsdom(`
            <p>
                <a class="good" href="https://github.com/jsdom">Good!</a>
                <a class="bad" href="https://github.com/jsdom">Bad!</a>
            </p>
        `);

        // Iterate, depth first, over a DOM node.
        // shouldTraverse - a function on a node saying whether we should include it
        //     and its children
        function *walk(node, shouldTraverse) {
            if (shouldTraverse(node)) {
                yield node;
                for (const child of node.childNodes) {
                    for (const w of walk(child, shouldTraverse)) {
                        yield w;
                    }
                }
            }
        }

        // Yield strings of text nodes within a normalized DOM node and its children,
        // without venturing into any contained block elements.
        function *inlineTexts(node) {
            // HACK: Not sure why `isBlock()` is undefined below.
            for (const child of walk(node, node => !(isBlock(node) || // eslint-disable-line no-undef
                                                   node.tagName === 'script' &&
                                                   node.tagName === 'style'))) {
                if (child.nodeType === child.TEXT_NODE) {
                    // .wholeText is what needs the DOM tree to be normalized.
                    // Otherwise, it'll return the contents of adjacent text nodes,
                    // too, and we'll get those contents a second time when we traverse
                    // to them.
                    yield child.wholeText;
                }
            }
        }

        function collapseWhitespace(str) {
            return str.replace(/\s{2,}/g, ' ');
        }

        // Return a fact that scores a DOM node based on how much it resembles a
        // maximally tight block element full of text.
        // HACK: We shouldn't ignore unused code.
        function paragraphish(node) { // eslint-disable-line no-unused-vars
            return {
                flavor: 'paragraphish',
                score: sum(map(inlineTexts(node),
                               str => collapseWhitespace.length))
            };
        }

        const rules = ruleset(
            rule(dom('a[class=good]'), node => [{scoreMultiplier: 2, flavor: 'anchor'}])
        );
        // HACK: We shouldn't ignore unused code.
        const kb = rules.score(doc); // eslint-disable-line no-unused-vars
    }
});
