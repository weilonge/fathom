import "babel-polyfill";
import {forEach, isEmpty, map, sum} from 'lodash';
var jsdom = require("jsdom");


// Wrap a DOM element to provide a handier API for scoring and tagging.
// If we end up not doing our work directly to the DOM tree in the future, this
// saves us rewriting all our transformers.
// function node(element) {
//     return {
//         __proto__: element,
//         rate
// }


// Iterate over a DOM tree or subtree, computing scores for interesting nodes
// and adding them to my knowledgebase.
//
// This is the "rank" portion of the rank-and-yank algorithm.
function score(tree, rules) {
    var dirtyRules = new Set();
    var oldDirtyRules;
    var facts = knowledgebase();

    tree.normalize();
    
    forEach(rules.ofKind('dom'), dirtyRules.add);
    do {
        oldDirtyRules = Array.from(dirtyRules);
        forEach(oldDirtyRules,
                rule => facts.add(resultsOf(rule)));  // may dirty additional things (or the same thing!)
        dirtyRules.concat(...forEach(facts.dirtyTypes(),
                                     type => rules.taking(type)));
    } while (dirtyRules.size);

    return facts;
}


function resultsOf(rule) {
    // If more types of rule pop up someday, do fancier dispatching here.
    return rule.kind === 'typed' ? resultsOfTypedRule(rule) : resultsOfDomRule(rule);
}


function resultsOfDomRule(rule) {
    var matches = tree.querySelectorAll(pattern);
    for (let element of matches) {
        anyMatched = true;
        // Transform element according to RHS of rule:
        transform(node(element));
    }
}


// Iterate, depth first, over a DOM node.
// shouldTraverse - a function on a node saying whether we should include it
//     and its children
function *walk(node, shouldTraverse) {
    if (shouldTraverse(node)) {
        yield node;
        for (child of node.childNodes) {
            for (w of walk(child, shouldTraverse)) {
                yield w;
            }
        }
    }
}


// Yield strings of text nodes within a normalized DOM node and its children,
// without venturing into any contained block elements.
function *inlineTexts(node) {
    for (child of walk(node, node => !(isBlock(node) ||
                                       node.tagName === 'script' &&
                                       node.tagName === 'style'))) {
        if (child.nodeType === child.TEXT_NODE) {
            yield child.wholeText;
        }
    }
}


function collapseWhitespace(str) {
    return str.replace(/\s{2,}/g, " ");
}


// Score a DOM node based on how much it resembles a maximally tight block
// element full of text.
function paragraphish(node) {
    return {
        type: 'paragraphish',
        score: sum(map(inlineTexts(node),
                       str => collapseWhitespace.length))
    }
}


function main() {
    var doc = jsdom.jsdom(
        '<p><a class="ad" href="https://github.com/tmpvar/jsdom">jsdom!</a></p>'
    );
    var rules = [
        // Score by length of directly contained text:
        rule(dom('p,div'), paragraphish),
        // Give bonus for being in a semantically appropriate tag:
        rule(typed('paragraphish'), node => node.el.tagName == 'p' ? 1.5 : 1)
    ];

    score(doc, rules);
}


main();


// Return a rule that uses a DOM selector to find its matches from the
// original DOM tree.
//
// For consistency, Nodes will still be delivered to the transformers, but they'll have empty types and score = 1. If the verb returns null, bail out and don't add the node to any indices.
function dom(selector) {
    return {
        kind: 'dom',
        selector: selector
    }
}


// Return a rule that pulls nodes out of the knowledgebase by type.
function typed(type) {
    return {
        kind: 'typed',
        type: type
    }
}


function rule(source, mixer, verb) {
    
}


// NEXT: This set of rules might be the beginning of something that works. (It's modeled after what I do when I try to do this by hand: I look for balls of black text, and I look for them to be near each other, generally siblings: a "cluster" of them.) Order of rules matters (until we find a reason to add more complexity). (We can always help people insert new rules in the desired order by providing a way to insert them before or after such-and-such a named rule.) Perhaps we might as well remove the "mixer" arg from rule() and just do the math in the verbs, since we won't do parallelism at first. And it turned out we didn't use the types much, so maybe we should get rid of those or at least factor them out.
// score on text length -> texty. We start with this because, no matter the other markup details, the main body text is definitely going to have a bunch of text. Every node starts with a score of 1, so we can just multiply all the time.
rule(dom('p,div'), node => ['texty', len(node.mergedStrippedInnerTextNakedOrInInlineTags)] if > 0 else null)  // maybe log or sqrt(char_count) or something. Char count might work even for CJK. mergedInnerTextNakedOrInInInlineTags() doesn't count chars in, say, p (or any other block-level) tags within a div tag.
rule(typed('texty'), node.linkDensity)
// give bonuses for being in p tags. TODO: article tags, too
rule(typed('texty'), node => node.el.tagName == 'p' ? 1.5 : 1)
// give bonuses for being (nth) cousins of other texties  // IOW, texties that are the same-leveled children of a common ancestor get a bonus.
rule(typed('texty'), node => node.numCousinsOfAtLeastOfScore(200) * 1.5)
// Find the texty with the highest score.

// Let rules return multiple knowledgebase entries (even of multiple types), in case we need to label or score a node on 2 orthogonal axes.

// A fancier selector design, with combinators:
rule(and(tag('p'), klass('snork')), scored('texty', node => node.word_count))  // and, tag, and klass are object constructors that the query engine can read. They don't actually do the query themselves. That way, a query planner can be smarter than them, figuring out which indices to use based on all of them. (We'll probably keep a heap by each dimension's score and a hash by type name, for starters.)

// We don't need to know up front what types may be emitted; we can just observe which indices were touched and re-run the rules that take those types in, then the rules that take *those* emitted types in, etc.
// How do we ensure blockquotes, h2s, uls, etc. that are part of the article are included? Maybe what we're really looking for is a single, high-scoring container (or span of a container?) and then taking either everything inside it or everything but certain excised bits (interstitial ads/relateds). There might be 2 phases: rank and yank.
// Also do something about invisible nodes.

Yankers:
max score (on some dimension)
max-scored sibling cluster (maybe a contiguous span of containers around high-scoring ones, like a blur algo allowing occasional flecks of low-scoring noise)
adjacent max-scored sibling clusters (like for Readability's remove-extra-paragraphs test, which has 2 divs, each containing <p>s)

Yanking:
* Block-level containers at the smallest. (Any smaller, and you're pulling out parts of paragraphs, not entire paragraphs.) mergedInnerTextNakedOrInInInlineTags might make this superfluous.


Advantages over readability:
* State clearly contained
* Should work fine with ideographic languages and others that lack space-delimited words
* Pluggable
* Potential to have rules generated or tuned by training
* Adaptable to find things other than the main body text