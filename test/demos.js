const assert = require('chai').assert;
const jsdom = require('jsdom');
const {map, sum} = require('lodash');

const {dom, rule, ruleset} = require('../fathom');


describe('Design-driving demos', function() {
    it('handles a simple series of short-circuiting rules', function () {
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
                 node => [{score: 40, flavor: 'titley', notes: node.element.content}]),
            rule(dom('meta[property="twitter:title"]'),
                 node => [{score: 30, flavor: 'titley', notes: node.element.content}]),
            rule(dom('meta[name="hdl"]'),
                 node => [{score: 20, flavor: 'titley', notes: node.element.content}]),
            rule(dom('title'),
                 node => [{score: 10, flavor: 'titley', notes: node.element.text}])
        );
        const kb = rules.score(doc);
        const node = kb.max('titley');
        assert.equal(node.score, 40);
        assert.equal(node.flavors.get('titley'), 'OpenGraph');
    });

    it("takes a decent shot at doing Readability's job", function () {
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
            for (const child of walk(node,
                                     node => !(isBlock(node) ||
                                               node.tagName === 'script' &&
                                               node.tagName === 'style'))) {
                if (child.nodeType === child.TEXT_NODE) {
                    // .wholeText needs the DOM tree to be normalized.
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

        // Score a node based on how much text is directly inside it and its
        // inline-tag children.
        function paragraphishByLength(node) {
            return {
                flavor: 'paragraphish',
                score: sum(map(inlineTexts(node),
                               text => collapseWhitespace(text).length))
            };
        }

        const doc = jsdom.jsdom(`
            <p>
                <a class="good" href="/things">Things</a> / <a class="bad" href="/things/tongs">Tongs</a>
            </p>
            <p>
                Once upon a time, there was a large bear named Sid. Sid was very large and bearish, and he had a bag of hammers.
            </p>
            <p>
                One day, Sid traded the bag of hammers to a serial scribbler named Sam for a dozen doughnuts. It was a good trade. Sid lived happily ever after.
            </p>
        `);
        // This set of rules might be the beginning of something that works.
        // (It's modeled after what I do when I try to do this by hand: I look
        // for balls of black text, and I look for them to be near each other,
        // generally siblings: a "cluster" of them.)
        const rules = ruleset(
            // Score on text length -> texty. We start with this because, no matter
            // the other markup details, the main body text is definitely going to
            // have a bunch of text.
            rule(dom('p,div'), paragraphishByLength)

            //rule(flavor('paragraphish'), node => ({score: linkDensity})),

            // Give bonuses for being in p tags. TODO: article tags, too
            //rule(flavor('texty'), node => ({score: node.el.tagName === 'p' ? 1.5 : 1})),

            // Give bonuses for being (nth) cousins of other texties. IOW,
            // texties that are the same-leveled children of a common ancestor
            // get a bonus.
            //rule(flavor('texty'), node => ({score: numCousinsOfAtLeastOfScore(node, 200) * 1.5}))

            // TODO: How do we ensure blockquotes, h2s, uls, etc. that are part of the article are included? Maybe what we're really looking for is a single, high-scoring container (or span of a container?) and then taking either everything inside it or everything but certain excised bits (interstitial ads/relateds). There might be 2 phases: rank and yank.
            // TODO: Also do something about invisible nodes.
        );
        const kb = rules.score(doc);
        debugger;
    });
});
