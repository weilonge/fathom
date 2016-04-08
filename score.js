import "babel-polyfill";
var jsdom = require("jsdom");


// Wrap a DOM element to provide a handier API for scoring and tagging.
// If we end up not doing our work directly to the DOM tree in the future, this
// saves us rewriting all our transformers.
// function node(element) {
//     return {
//         __proto__: element,
//         rate
// }


function zeroScore(node) {
    label(node, 'main-text', 0);
}


function idScore(node) {
    // Do regex stuff and return a score.
}


var rules = [
    ['.ad', zeroScore],
    ['[id]', idScore]
];


// Tag a DOM tree or subtree with scores.
// Maybe this will become the map portion of a map-reduce analog.
function score(tree, rules) {
    var anyMatched;

    do {
        anyMatched = false;
        for (let [pattern, transform] of rules) {
            var matches = tree.querySelectorAll(pattern);
            for (let element of matches) {
                anyMatched = true;
                // Transform element according to RHS of rule:
                transform(node(element));
            }
        }
    } while (anyMatched);
}


// Remove any pre-existing fm-* classes and attrs so they don't interfere with
// our calculations.
function clean(tree) {
    // TODO: Implement.
}


function main() {
    var doc = jsdom.jsdom(
        '<p><a class="ad" href="https://github.com/tmpvar/jsdom">jsdom!</a></p>'
    );
    clean(doc);
    score(doc, rules);
}


main();
// NEXT: Write up a sane series of rules. Then write a system that can run them. I'm not so sure about computing in-DOM anymore; tag names are read-only, and class names are inefficient to search.
// When I try to do this by hand, I look for balls of black text, and I look for them to be near each other, on the same nesting level: a "cluster" of them.


// Use a DOM selector to find nodes to match this rule, from the original DOM tree. For consistency, Nodes will still be delivered to the transformers, but they'll have empty types and no scores. If the verb returns null, bail out and don't add the node to any indices.
function dom(selector) {
    
}


// Add the number returned by the transformer to the score.
// By not doing the addition in the transformer itself, we leave open the possibility of running rules in parallel.
function bonus() {
    
}


// First we run the source=dom rules, then the mixer=bonus ones, then mixer=scale
function rule(source, mixer, verb) {
    
}



// score on text length -> texty
rule(dom('p,div'), bonus, node => ['texty', scaleByLinkDensity(len(node.mergedInnerText))] if > 0 else null)  // maybe log or sqrt(char_count) or something. Char count might work even for CJK.
// give bonuses for being in p tags
rule(type('texty'), bonus, node => distanceUpTo('p', node)
// give bonuses for being (nth) cousins of other texties  // IOW, texties that are the same-leveled children of a common ancestor get a bonus.
// Find the texty with the highest score.

// Let rules return multiple knowledgebase entries, in case we need to label or score a node on 2 orthogonal axes.

rule(and(tag('p'), klass('snork')), scored('texty', node => node.word_count))  // and, tag, and klass are object constructors that the query engine can read. They don't actually do the query themselves. That way, a query planner can be smarter than them, figuring out which indices to use based on all of them. (We'll probably keep a heap by each dimension's score and a hash by type name, for starters.)

// But wait: if we convert the type of each node with each rule, how is this different from just an imperative program? It's not necessarily bad if it isn't. Just make sure there's a good way to hook in more/3rd-party rules.
// We don't need to know up front what types may be emitted; we can just observe which indices were touched and re-run the rules that take those types in, then the rules that take *those* emitted types in, etc.

blah bonus { return 6; }