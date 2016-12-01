const assert = require('chai').assert;
const {jsdom} = require('jsdom');

const {dom, flavor, func, out, rule, ruleset, type} = require('../index');
const {inlineTextLength, linkDensity, rootElement, sum} = require('../utils');


describe('Design-driving demos', function () {
    it('handles a simple series of short-circuiting rules', function () {
        // TODO: Short-circuiting isn't implemented yet. The motivation of this
        // test is to inspire changes to ranker functions that make them more
        // declarative, such that the engine can be smart enough to run the
        // highest-possible-scoring flavor-chain of rules first and, if it
        // succeeds, omit the others.
        const doc = jsdom(`
            <meta name="hdl" content="HDL">
            <meta property="og:title" content="OpenGraph">
            <meta property="twitter:title" content="Twitter">
            <title>Title</title>
        `);
        const typeAndNote = type('titley').note(fnode => fnode.element.content);
        const rules = ruleset(
            rule(dom('meta[property="og:title"]'),
                 typeAndNote.score(40)),
            rule(dom('meta[property="twitter:title"]'),
                 typeAndNote.score(30)),
            rule(dom('meta[name="hdl"]'),
                 typeAndNote.score(20)),
            rule(dom('title'),
                 typeAndNote.score(10).note(fnode => fnode.element.text)),
            rule(type('titley').max(), out('titley'))
        );
        const facts = rules.against(doc);
        const node = facts.get('titley')[0];
        assert.equal(node.scoreFor('titley'), 40);
        assert.equal(node.noteFor('titley'), 'OpenGraph');
    });

    it('identifies logged-in pages', function () {
        // Return the number of times a regex occurs within the string `haystack`.
        // Caller must make sure `regex` has the 'g' option set.
        function numberOfMatches(regex, haystack) {
            return (haystack.match(regex) || []).length;
        }

        // Stick a score on the root element based on how much the classes on `fnode`
        // mention logging out.
        function scoreRootByLogoutClasses(fnode) {
            const classes = Array.from(fnode.element.classList);
            const score = Math.pow(2,
                                   sum(classes.map(cls => numberOfMatches(/(?:^|[-_])(?:log[-_]?out|sign[-_]?out)(?:$|[-_ $])/ig, cls))));
            return score > 1 ? {element: rootElement(fnode.element),
                                score,
                                type: 'logoutClass'} : {};
        }

        function scoreRootByLogoutHrefs(fnode) {
            const href = fnode.element.getAttribute('href');
            const score = Math.pow(2, numberOfMatches(/(?:^|\W)(?:log[-_]?out|sign[-_]?out)(?:$|\W)/ig, href));
            return score > 1 ? {element: rootElement(fnode.element),
                                score,
                                type: 'logoutHref'} : {};
        }

        const rules = ruleset(
            rule(dom('button[class]'), func(scoreRootByLogoutClasses).typeIn('logoutClass')),
            rule(dom('a[class]'), func(scoreRootByLogoutClasses).typeIn('logoutClass')),
            // Look for "logout" or "signout" in hrefs:
            rule(dom('a[href]'), func(scoreRootByLogoutHrefs).typeIn('logoutHref')),
//             rule(dom('a[href]') look for "Log out" or "logout" or "Sign out" in content  // bonus for English pages
            rule(type('logoutClass'), type('loggedIn').conserveScore()),
            rule(type('logoutHref'), type('loggedIn').conserveScore())
        );

        function isProbablyLoggedIn(doc) {
            const ins = rules.against(doc).get(type('loggedIn'));
            return ins.length && ins[0].scoreFor('loggedIn') > 1;
        }

        // air.mozilla.org:
        assert(isProbablyLoggedIn(jsdom(`
            <html>
                <a href="/authentication/signout/" class="signout">Sign Out</a>
            </html>
        `)));
        // crateandbarrel.com
        assert(isProbablyLoggedIn(jsdom(`
            <html>
                <div class="dropdown-sign-in">
                    <a href="/account/logout" rel="nofollow">Sign Out</a>
                </div>
            </html>
        `)));
        // slashdot.org
        assert(isProbablyLoggedIn(jsdom(`
            <html>
                <a href="///slashdot.org/my/logout">
                  Log out
                </a>
            </html>
        `)));
        // news.ycombinator.com
        assert(isProbablyLoggedIn(jsdom(`
            <html>
                <a href="logout?auth=123456789abcdef&amp;goto=news">logout</a>
            </html>
        `)));
    });

    it.skip("takes a decent shot at doing Readability's job", function () {
        // Score a node based on how much text is directly inside it and its
        // inline-tag children.
        function paragraphishByLength(node) {
            const length = inlineTextLength(node.element);
            return {
                flavor: 'paragraphish',
                score: length,
                notes: {inlineLength: length}  // Store expensive inline length.
            };
        }

        const doc = jsdom(`
            <p>
                <a class="good" href="/things">Things</a> / <a class="bad" href="/things/tongs">Tongs</a>
            </p>
            <p>
                Once upon a time, there was a large bear named Sid. Sid was very large and bearish, and he had a bag of hammers.
            </p>
            <div>
                <p>
                    One day, Sid traded the bag of hammers to a serial scribbler named Sam for a dozen doughnuts. It was a good trade. Sid lived happily ever after.
                </p>
            </div>
        `);
        // This set of rules might be the beginning of something that works.
        // (It's modeled after what I do when I try to do this by hand: I look
        // for balls of black text, and I look for them to be near each other,
        // generally siblings: a "cluster" of them.)
        const rules = ruleset(
            // Score on text length -> texty. We start with this because, no matter
            // the other markup details, the main body text is definitely going to
            // have a bunch of text.
            rule(dom('p,div'), paragraphishByLength),

            // Scale it by inverse of link density:
            rule(flavor('paragraphish'), node => ({score: 1 - linkDensity(node)}))

            // Give bonuses for being in p tags. TODO: article tags, too
            //rule(flavor('texty'), node => ({score: node.el.tagName === 'p' ? 1.5 : 1})),

            // Give bonuses for being (nth) cousins of other texties. IOW,
            // texties that are the same-leveled children of a common ancestor
            // get a bonus.
            //rule(flavor('texty'), node => ({score: numCousinsOfAtLeastOfScore(node, 200) * 1.5}))

            // Then do a nontrivial yanker which figures out which clump of high-scoring paragraphishes and the things between them to grab.
            // TODO: How do we ensure blockquotes, h2s, uls, etc. that are part of the article are included? Maybe what we're really looking for is a single, high-scoring container (or span of a container?) and then taking either everything inside it or everything but certain excised bits (interstitial ads/relateds). There might be 2 phases: rank and yank.
            // TODO: Also do something about invisible nodes.
        );
        const kb = rules.score(doc);
        const paragraphishes = kb.nodesOfFlavor('paragraphish');
        assert.equal(paragraphishes[0].score, 5);
        assert.equal(paragraphishes[1].score, 114);
        assert.equal(paragraphishes[3].score, 146);

//         assert.equal(clusters(paragraphishes),
//                      [[paragraphishes[0],
//                        paragraphishes[1]],
//                       [paragraphishes[3]]]);
        // Then pick the cluster with the highest sum of scores or the cluster around the highest-scoring node or the highest-scoring cluster by some formula (num typed nodes * scores of the nodes), and contiguous() it so things like ads are excluded but short paragraphs are included.
    });
});

// Right now, I'm writing features. We can use a supervised learning algorithm to find their coefficients. Someday, we can stop writing features and have deep learning algorithm come up with them. TODO: Grok unsupervised learning, and apply it to OpenCrawl.
// If we ever end up doing actual processing server-side, consider cheeriojs instead of jsdom. It may be 8x faster, though with a different API.
